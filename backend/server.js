const express = require('express');
const cors = require('cors');
const { sql, poolPromise } = require('./db');
const { sha256 } = require('js-sha256');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// STUDENT AUTH

// POST /api/auth/student/signup
app.post('/api/auth/student/signup', async (req, res) => {
    try {
        const { firstName, lastName, rollNumber, email, password } = req.body;
        if (!firstName || !lastName || !rollNumber || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const pool = await poolPromise;

        // Check if already exists
        const check = await pool.request()
            .input('Email', sql.NVARCHAR, email)
            .input('RollNumber', sql.NVARCHAR, rollNumber)
            .query('SELECT StudentID FROM Students WHERE Email = @Email OR RollNumber = @RollNumber');

        if (check.recordset.length > 0) {
            return res.status(409).json({ error: 'Student with this email or roll number already exists' });
        }

        const result = await pool.request()
            .input('FirstName', sql.NVARCHAR, firstName)
            .input('LastName', sql.NVARCHAR, lastName)
            .input('RollNumber', sql.NVARCHAR, rollNumber)
            .input('Email', sql.NVARCHAR, email)
            .input('PasswordHash', sql.NVARCHAR, sha256(password))
            .query(`INSERT INTO Students (FirstName, LastName, RollNumber, Email, PasswordHash) 
                    OUTPUT INSERTED.StudentID 
                    VALUES (@FirstName, @LastName, @RollNumber, @Email, @PasswordHash)`);

        res.status(201).json({
            message: 'Account created',
            student: {
                id: result.recordset[0].StudentID,
                firstName: firstName,
                lastName: lastName,
                rollNumber: rollNumber,
                email: email
            }
        });
    } catch (err) {
        console.error('Signup Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/auth/student/login
app.post('/api/auth/student/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

        const pool = await poolPromise;
        const result = await pool.request()
            .input('Email', sql.NVARCHAR, email)
            .query('SELECT StudentID, FirstName, LastName, RollNumber, PasswordHash FROM Students WHERE Email = @Email');

        if (result.recordset.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

        const student = result.recordset[0];
        if (sha256(password) !== student.PasswordHash) return res.status(401).json({ error: 'Invalid credentials' });

        res.json({
            message: 'Login successful',
            student: {
                id: student.StudentID,
                firstName: student.FirstName,
                lastName: student.LastName,
                rollNumber: student.RollNumber,
                email: email
            }
        });
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// ADMIN AUTH

// POST /api/auth/admin/signup
app.post('/api/auth/admin/signup', async (req, res) => {
    try {
        const { operatorName, email, password } = req.body;
        if (!operatorName || !email || !password) return res.status(400).json({ error: 'All fields are required' });

        const pool = await poolPromise;

        const check = await pool.request()
            .input('Email', sql.NVARCHAR, email)
            .query('SELECT AdminID FROM Admins WHERE DepartmentEmail = @Email');

        if (check.recordset.length > 0) return res.status(409).json({ error: 'Admin with this email already exists' });

        const result = await pool.request()
            .input('OperatorName', sql.NVARCHAR, operatorName)
            .input('DepartmentEmail', sql.NVARCHAR, email)
            .input('PasswordHash', sql.NVARCHAR, sha256(password))
            .query(`INSERT INTO Admins (OperatorName, DepartmentEmail, PasswordHash) 
                    OUTPUT INSERTED.AdminID 
                    VALUES (@OperatorName, @DepartmentEmail, @PasswordHash)`);

        res.status(201).json({ message: 'Admin account created', adminId: result.recordset[0].AdminID });
    } catch (err) {
        console.error('Admin Signup Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/auth/admin/login
app.post('/api/auth/admin/login', async (req, res) => {
    try {
        const { idOrEmail, password } = req.body;
        if (!idOrEmail || !password) return res.status(400).json({ error: 'Email and password are required' });

        const pool = await poolPromise;
        const result = await pool.request()
            .input('Identifier', sql.NVARCHAR, idOrEmail)
            .query(`SELECT AdminID, OperatorName, PasswordHash, RoleLevel FROM Admins 
                    WHERE DepartmentEmail = @Identifier OR CAST(AdminID AS NVARCHAR) = @Identifier`);

        if (result.recordset.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

        const admin = result.recordset[0];
        // Check hashed password, or allow plaintext for seeded admin
        if (sha256(password) !== admin.PasswordHash && password !== admin.PasswordHash) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        res.json({
            message: 'Login successful',
            admin: { id: admin.AdminID, operatorName: admin.OperatorName, roleLevel: admin.RoleLevel }
        });
    } catch (err) {
        console.error('Admin Login Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// STUDENT PROFILE (CGPA, branch, backlogs)

// GET /api/student/profile?studentId=1
app.get('/api/student/profile', async (req, res) => {
    try {
        const { studentId } = req.query;
        if (!studentId) return res.status(400).json({ error: 'studentId is required' });

        const pool = await poolPromise;
        const result = await pool.request()
            .input('StudentID', sql.INT, studentId)
            .query(`SELECT s.FirstName, s.LastName, s.RollNumber, s.Email,
                           p.CGPA, p.Branch, p.GradYear, p.Backlogs
                    FROM Students s
                    LEFT JOIN StudentProfiles p ON s.StudentID = p.StudentID
                    WHERE s.StudentID = @StudentID`);

        if (result.recordset.length === 0) return res.status(404).json({ error: 'Student not found' });
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Profile GET Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/student/profile  (create or update)
app.post('/api/student/profile', async (req, res) => {
    try {
        const { studentId, cgpa, branch, gradYear, backlogs } = req.body;
        if (!studentId || !cgpa || !branch || !gradYear) {
            return res.status(400).json({ error: 'studentId, cgpa, branch, and gradYear are required' });
        }

        const pool = await poolPromise;

        // MERGE = upsert in SQL
        await pool.request()
            .input('StudentID', sql.INT, studentId)
            .input('CGPA', sql.DECIMAL(4, 2), cgpa)
            .input('Branch', sql.NVARCHAR, branch)
            .input('GradYear', sql.INT, gradYear)
            .input('Backlogs', sql.INT, backlogs || 0)
            .query(`MERGE StudentProfiles AS target
                    USING (SELECT @StudentID AS StudentID) AS source
                    ON target.StudentID = source.StudentID
                    WHEN MATCHED THEN
                        UPDATE SET CGPA = @CGPA, Branch = @Branch, GradYear = @GradYear, 
                                   Backlogs = @Backlogs, UpdatedAt = GETDATE()
                    WHEN NOT MATCHED THEN
                        INSERT (StudentID, CGPA, Branch, GradYear, Backlogs)
                        VALUES (@StudentID, @CGPA, @Branch, @GradYear, @Backlogs);`);

        res.json({ message: 'Profile saved' });
    } catch (err) {
        console.error('Profile POST Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// DRIVES

// GET /api/drives  — all active drives (uses the view)
app.get('/api/drives', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT * FROM vw_DriveDetails WHERE IsActive = 1 ORDER BY Deadline ASC');
        res.json(result.recordset);
    } catch (err) {
        console.error('Drives GET Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/drives/:id/apply  — apply to a drive (calls stored procedure)
app.post('/api/drives/:id/apply', async (req, res) => {
    try {
        const { studentId } = req.body;
        const driveId = req.params.id;
        if (!studentId) return res.status(400).json({ error: 'studentId is required' });

        const pool = await poolPromise;
        const result = await pool.request()
            .input('StudentID', sql.INT, studentId)
            .input('DriveID', sql.INT, driveId)
            .execute('sp_ApplyToDrive');

        const row = result.recordset[0];
        res.status(row.Success ? 200 : 400).json({ success: !!row.Success, message: row.Message });
    } catch (err) {
        console.error('Apply Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// STUDENT APPLICATIONS

// GET /api/student/eligible-drives?studentId=1
app.get('/api/student/eligible-drives', async (req, res) => {
    try {
        const { studentId } = req.query;
        if (!studentId) return res.status(400).json({ error: 'studentId is required' });

        const pool = await poolPromise;
        const result = await pool.request()
            .input('StudentID', sql.INT, studentId)
            .execute('sp_GetEligibleDrives');

        res.json(result.recordset);
    } catch (err) {
        console.error('Eligible Drives Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/student/applications?studentId=1  (uses the view)
app.get('/api/student/applications', async (req, res) => {
    try {
        const { studentId } = req.query;
        if (!studentId) return res.status(400).json({ error: 'studentId is required' });

        const pool = await poolPromise;
        const result = await pool.request()
            .input('StudentID', sql.INT, studentId)
            .query('SELECT * FROM vw_StudentDashboard WHERE StudentID = @StudentID ORDER BY AppliedAt DESC');
        res.json(result.recordset);
    } catch (err) {
        console.error('Applications GET Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// ELIGIBILITY CHECK

// POST /api/eligibility/check  (calls stored procedure)
app.post('/api/eligibility/check', async (req, res) => {
    try {
        const { studentId, driveId } = req.body;
        if (!studentId || !driveId) return res.status(400).json({ error: 'studentId and driveId are required' });

        const pool = await poolPromise;
        const result = await pool.request()
            .input('StudentID', sql.INT, studentId)
            .input('DriveID', sql.INT, driveId)
            .execute('sp_CheckEligibility');

        const row = result.recordset[0];
        res.json({ eligible: !!row.IsEligible, reason: row.Reason });
    } catch (err) {
        console.error('Eligibility Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// ADMIN ROUTES

// GET /api/admin/stats  (uses the view)
app.get('/api/admin/stats', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM vw_AdminDashboard');
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Admin Stats Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/admin/applications  — recent applications for the admin table
app.get('/api/admin/applications', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query(`SELECT TOP 50
                        a.ApplicationID, s.RollNumber, s.FirstName + ' ' + s.LastName AS StudentName,
                        c.Name AS CompanyName, a.Status, a.AppliedAt
                    FROM Applications a
                    JOIN Students  s ON a.StudentID = s.StudentID
                    JOIN Drives    d ON a.DriveID   = d.DriveID
                    JOIN Companies c ON d.CompanyID  = c.CompanyID
                    ORDER BY a.AppliedAt DESC`);
        res.json(result.recordset);
    } catch (err) {
        console.error('Admin Applications Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PATCH /api/admin/applications/:id — update application status
app.patch('/api/admin/applications/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const appId = req.params.id;
        if (!status) return res.status(400).json({ error: 'status is required' });

        const pool = await poolPromise;
        const updateRes = await pool.request()
            .input('Status', sql.NVARCHAR, status)
            .input('ApplicationID', sql.INT, appId)
            .query(`
                UPDATE Applications 
                SET Status = @Status, UpdatedAt = GETDATE() 
                OUTPUT INSERTED.StudentID, INSERTED.DriveID
                WHERE ApplicationID = @ApplicationID
            `);
            
        if (updateRes.recordset.length > 0) {
            const { StudentID, DriveID } = updateRes.recordset[0];
            
            // Get Company info for the notification
            const driveInfo = await pool.request()
                .input('DriveID', sql.INT, DriveID)
                .query(`SELECT c.Name AS CompanyName, d.Role 
                        FROM Drives d
                        JOIN Companies c ON d.CompanyID = c.CompanyID
                        WHERE d.DriveID = @DriveID`);
            
            const { CompanyName, Role } = driveInfo.recordset[0] || { CompanyName: 'a Company', Role: 'a Role' };
            
            // Dispatch Automatic Notification
            await pool.request()
                .input('StudentID', sql.INT, StudentID)
                .input('Title', sql.NVARCHAR, `Application Update: ${CompanyName}`)
                .input('Message', sql.NVARCHAR, `Your application for the ${Role} role at ${CompanyName} has been updated to: ${status}.`)
                .query(`INSERT INTO Notifications (StudentID, Title, Message, Type) VALUES (@StudentID, @Title, @Message, 'Alert')`);
        }
                    
        res.json({ success: true, message: 'Status updated and notification sent' });
    } catch (err) {
        console.error('Update Application Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/admin/drives  — admin creates a new drive
app.post('/api/admin/drives', async (req, res) => {
    try {
        const { companyName, role, packageLPA, deadline, description, minCGPA, maxBacklogs, allowedBranches } = req.body;
        if (!companyName || !role || !packageLPA || !deadline) {
            return res.status(400).json({ error: 'companyName, role, packageLPA, and deadline are required' });
        }

        const pool = await poolPromise;
        
        // 1. Find or create company
        let companyId;
        const compRes = await pool.request()
            .input('Name', sql.NVARCHAR, companyName)
            .query('SELECT CompanyID FROM Companies WHERE Name = @Name');
            
        if (compRes.recordset.length > 0) {
            companyId = compRes.recordset[0].CompanyID;
        } else {
            const insertComp = await pool.request()
                .input('Name', sql.NVARCHAR, companyName)
                .input('LogoInitial', sql.CHAR, companyName.charAt(0).toUpperCase())
                .input('LogoColor', sql.NVARCHAR, '#a855f7') // default color
                .query(`INSERT INTO Companies (Name, LogoInitial, LogoColor) 
                        OUTPUT INSERTED.CompanyID 
                        VALUES (@Name, @LogoInitial, @LogoColor)`);
            companyId = insertComp.recordset[0].CompanyID;
        }

        // 2. Insert Drive
        const result = await pool.request()
            .input('CompanyID', sql.INT, companyId)
            .input('Role', sql.NVARCHAR, role)
            .input('PackageLPA', sql.DECIMAL(5, 1), packageLPA)
            .input('Deadline', sql.DATE, deadline)
            .input('Description', sql.NVARCHAR, description || '')
            .input('MinCGPA', sql.DECIMAL(4, 2), minCGPA || 0)
            .input('MaxBacklogs', sql.INT, maxBacklogs || 0)
            .input('AllowedBranches', sql.NVARCHAR, allowedBranches || '')
            .query(`INSERT INTO Drives (CompanyID, Role, PackageLPA, Deadline, Description, MinCGPA, MaxBacklogs, AllowedBranches)
                    OUTPUT INSERTED.DriveID
                    VALUES (@CompanyID, @Role, @PackageLPA, @Deadline, @Description, @MinCGPA, @MaxBacklogs, @AllowedBranches)`);

        res.status(201).json({ message: 'Drive created', driveId: result.recordset[0].DriveID });
    } catch (err) {
        console.error('Create Drive Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// GET /api/admin/drives/:id/applicants — list of students who applied to this drive
app.get('/api/admin/drives/:id/applicants', async (req, res) => {
    try {
        const driveId = req.params.id;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('DriveID', sql.INT, driveId)
            .query(`SELECT s.RollNumber, s.FirstName + ' ' + s.LastName AS StudentName,
                           s.Email, p.CGPA, p.Branch, a.Status, a.AppliedAt
                    FROM Applications a
                    JOIN Students s ON a.StudentID = s.StudentID
                    LEFT JOIN StudentProfiles p ON s.StudentID = p.StudentID
                    WHERE a.DriveID = @DriveID
                    ORDER BY a.AppliedAt DESC`);
        res.json(result.recordset);
    } catch (err) {
        console.error('Drive Applicants Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PATCH /api/admin/drives/:id/close
app.patch('/api/admin/drives/:id/close', async (req, res) => {
    try {
        const driveId = req.params.id;
        const pool = await poolPromise;
        await pool.request()
            .input('DriveID', sql.INT, driveId)
            .query('UPDATE Drives SET IsActive = 0 WHERE DriveID = @DriveID');
        res.json({ message: 'Drive closed successfully' });
    } catch (err) {
        console.error('Close Drive Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// SYSTEM MODULES: Students & Notifications

// GET /api/admin/students
app.get('/api/admin/students', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT s.StudentID, s.FirstName, s.LastName, s.RollNumber, s.Email,
                   p.CGPA, p.Branch, p.Backlogs
            FROM Students s
            LEFT JOIN StudentProfiles p ON s.StudentID = p.StudentID
            ORDER BY s.FirstName ASC`);
        res.json(result.recordset);
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/admin/notify
app.post('/api/admin/notify', async (req, res) => {
    try {
        const { title, message } = req.body;
        if (!title || !message) return res.status(400).json({ error: 'Title and message required' });
        
        const pool = await poolPromise;
        await pool.request()
            .input('Title', sql.NVARCHAR, title)
            .input('Message', sql.NVARCHAR, message)
            .query(`INSERT INTO Notifications (Title, Message, Type) VALUES (@Title, @Message, 'Alert')`);
            
        res.json({ success: true, message: 'Broadcast sent to all students' });
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/student/notifications
app.get('/api/student/notifications', async (req, res) => {
    try {
        const { studentId } = req.query;
        if (!studentId) return res.status(400).json({ error: 'studentId required' });
        
        const pool = await poolPromise;
        const result = await pool.request()
            .input('StudentID', sql.INT, studentId)
            .query(`SELECT * FROM Notifications 
                    WHERE StudentID = @StudentID OR StudentID IS NULL
                    ORDER BY CreatedAt DESC`);
        res.json(result.recordset);
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// SYSTEM MODULES: Document Verification

// POST /api/student/docs
app.post('/api/student/docs', async (req, res) => {
    try {
        const { studentId, documentType, fileUrl } = req.body;
        if (!studentId || !documentType || !fileUrl) return res.status(400).json({ error: 'Missing fields' });
        
        const pool = await poolPromise;
        await pool.request()
            .input('StudentID', sql.INT, studentId)
            .input('DocumentType', sql.NVARCHAR, documentType)
            .input('FileUrl', sql.NVARCHAR, fileUrl)
            .query(`INSERT INTO Documents (StudentID, DocumentType, FileUrl) VALUES (@StudentID, @DocumentType, @FileUrl)`);
            
        res.json({ success: true, message: 'Document uploaded' });
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/admin/docs
app.get('/api/admin/docs', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT d.DocumentID, d.DocumentType, d.FileUrl, d.VerificationStatus, d.UploadedAt,
                   s.FirstName + ' ' + s.LastName AS StudentName, s.RollNumber
            FROM Documents d
            JOIN Students s ON d.StudentID = s.StudentID
            ORDER BY d.UploadedAt DESC`);
        res.json(result.recordset);
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PATCH /api/admin/docs/:id
app.patch('/api/admin/docs/:id', async (req, res) => {
    try {
        const docId = req.params.id;
        const { status } = req.body; // 'Verified' or 'Rejected'
        
        const pool = await poolPromise;
        await pool.request()
            .input('DocumentID', sql.INT, docId)
            .input('Status', sql.NVARCHAR, status)
            .query(`UPDATE Documents SET VerificationStatus = @Status, VerifiedAt = GETDATE() WHERE DocumentID = @DocumentID`);
            
        res.json({ success: true, message: 'Status updated' });
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// START SERVER
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
