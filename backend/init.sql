-- ============================================================
-- PlaceTrack Database Setup
-- Run this entire script in SSMS to initialize everything
-- ============================================================

-- 1. Create Database
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'PlacementTrackerDB')
BEGIN
    CREATE DATABASE PlacementTrackerDB;
END
GO

USE PlacementTrackerDB;
GO

-- ============================================================
-- TABLES
-- ============================================================

-- Students (login/signup)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Students' AND xtype='U')
BEGIN
    CREATE TABLE Students (
        StudentID    INT IDENTITY(1,1) PRIMARY KEY,
        FirstName    NVARCHAR(100) NOT NULL,
        LastName     NVARCHAR(100) NOT NULL,
        RollNumber   NVARCHAR(50)  UNIQUE NOT NULL,
        Email        NVARCHAR(255) UNIQUE NOT NULL,
        PasswordHash NVARCHAR(255) NOT NULL,
        CreatedAt    DATETIME DEFAULT GETDATE()
    );
END
GO

-- Student Profiles (academic details, separate from login)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='StudentProfiles' AND xtype='U')
BEGIN
    CREATE TABLE StudentProfiles (
        ProfileID   INT IDENTITY(1,1) PRIMARY KEY,
        StudentID   INT UNIQUE NOT NULL FOREIGN KEY REFERENCES Students(StudentID),
        CGPA        DECIMAL(4,2) NOT NULL,
        Branch      NVARCHAR(50) NOT NULL,    -- CSE, IT, ECE, MECH
        GradYear    INT NOT NULL,
        Backlogs    INT DEFAULT 0,
        UpdatedAt   DATETIME DEFAULT GETDATE()
    );
END
GO

-- Admins
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Admins' AND xtype='U')
BEGIN
    CREATE TABLE Admins (
        AdminID         INT IDENTITY(1,1) PRIMARY KEY,
        OperatorName    NVARCHAR(100) NOT NULL,
        DepartmentEmail NVARCHAR(255) UNIQUE NOT NULL,
        PasswordHash    NVARCHAR(255) NOT NULL,
        RoleLevel       INT DEFAULT 1,
        CreatedAt       DATETIME DEFAULT GETDATE()
    );
END
GO

-- Companies
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Companies' AND xtype='U')
BEGIN
    CREATE TABLE Companies (
        CompanyID   INT IDENTITY(1,1) PRIMARY KEY,
        Name        NVARCHAR(200) NOT NULL,
        LogoInitial CHAR(1),          -- Single letter shown on cards
        LogoColor   NVARCHAR(20),     -- Hex color for the logo
        Website     NVARCHAR(500),
        CreatedAt   DATETIME DEFAULT GETDATE()
    );
END
GO

-- Placement Drives
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Drives' AND xtype='U')
BEGIN
    CREATE TABLE Drives (
        DriveID       INT IDENTITY(1,1) PRIMARY KEY,
        CompanyID     INT NOT NULL FOREIGN KEY REFERENCES Companies(CompanyID),
        Role          NVARCHAR(200) NOT NULL,
        PackageLPA    DECIMAL(5,1) NOT NULL,    -- e.g. 35.0
        Deadline      DATE NOT NULL,
        Description   NVARCHAR(500),
        -- Eligibility criteria (stored right here, simple)
        MinCGPA       DECIMAL(4,2) DEFAULT 0,
        MaxBacklogs   INT DEFAULT 0,
        AllowedBranches NVARCHAR(200),           -- comma-separated: 'CSE,IT,ECE'
        IsActive      BIT DEFAULT 1,
        CreatedAt     DATETIME DEFAULT GETDATE()
    );
END
GO

-- Applications (student applies to a drive)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Applications' AND xtype='U')
BEGIN
    CREATE TABLE Applications (
        ApplicationID INT IDENTITY(1,1) PRIMARY KEY,
        StudentID     INT NOT NULL FOREIGN KEY REFERENCES Students(StudentID),
        DriveID       INT NOT NULL FOREIGN KEY REFERENCES Drives(DriveID),
        Status        NVARCHAR(50) DEFAULT 'Applied',  -- Applied, In Review, Interview, Accepted, Rejected
        AppliedAt     DATETIME DEFAULT GETDATE(),
        UpdatedAt     DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_StudentDrive UNIQUE (StudentID, DriveID)  -- can't apply twice
    );
END
GO

-- Notifications (System alerts and emails)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Notifications' AND xtype='U')
BEGIN
    CREATE TABLE Notifications (
        NotificationID INT IDENTITY(1,1) PRIMARY KEY,
        StudentID      INT FOREIGN KEY REFERENCES Students(StudentID) NULL,  -- NULL means broadcast to all
        Title          NVARCHAR(200) NOT NULL,
        Message        NVARCHAR(1000) NOT NULL,
        Type           NVARCHAR(50) DEFAULT 'Alert',  -- Email, Alert
        IsRead         BIT DEFAULT 0,
        CreatedAt      DATETIME DEFAULT GETDATE()
    );
END
GO

-- Documents (Transcripts, Certificates verification)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Documents' AND xtype='U')
BEGIN
    CREATE TABLE Documents (
        DocumentID         INT IDENTITY(1,1) PRIMARY KEY,
        StudentID          INT NOT NULL FOREIGN KEY REFERENCES Students(StudentID),
        DocumentType       NVARCHAR(100) NOT NULL, -- e.g., 'Semester 6 Transcript'
        FileUrl            NVARCHAR(500) NOT NULL,
        VerificationStatus NVARCHAR(50) DEFAULT 'Pending', -- Pending, Verified, Rejected
        UploadedAt         DATETIME DEFAULT GETDATE(),
        VerifiedAt         DATETIME NULL
    );
END
GO


-- ============================================================
-- VIEWS (complex JOINs live here, not in Node.js)
-- ============================================================

-- View: Drive details with company info (for the drives page)
IF OBJECT_ID('vw_DriveDetails', 'V') IS NOT NULL DROP VIEW vw_DriveDetails;
GO
CREATE VIEW vw_DriveDetails AS
SELECT
    d.DriveID,
    c.CompanyID,
    c.Name          AS CompanyName,
    c.LogoInitial,
    c.LogoColor,
    d.Role,
    d.PackageLPA,
    d.Deadline,
    d.Description,
    d.MinCGPA,
    d.MaxBacklogs,
    d.AllowedBranches,
    d.IsActive,
    (SELECT COUNT(*) FROM Applications a WHERE a.DriveID = d.DriveID) AS TotalApplications
FROM Drives d
JOIN Companies c ON d.CompanyID = c.CompanyID;
GO

-- View: Student dashboard (my applications + company details)
IF OBJECT_ID('vw_StudentDashboard', 'V') IS NOT NULL DROP VIEW vw_StudentDashboard;
GO
CREATE VIEW vw_StudentDashboard AS
SELECT
    a.ApplicationID,
    a.StudentID,
    a.Status,
    a.AppliedAt,
    d.Role,
    d.PackageLPA,
    d.Deadline,
    c.Name       AS CompanyName,
    c.LogoInitial,
    c.LogoColor
FROM Applications a
JOIN Drives    d ON a.DriveID   = d.DriveID
JOIN Companies c ON d.CompanyID = c.CompanyID;
GO

-- View: Admin dashboard stats
IF OBJECT_ID('vw_AdminDashboard', 'V') IS NOT NULL DROP VIEW vw_AdminDashboard;
GO
CREATE VIEW vw_AdminDashboard AS
SELECT
    (SELECT COUNT(*) FROM Students)                                         AS TotalStudents,
    (SELECT COUNT(*) FROM Drives WHERE IsActive = 1)                        AS ActiveDrives,
    (SELECT COUNT(*) FROM Applications WHERE Status = 'Accepted')           AS StudentsPlaced,
    (SELECT COUNT(*) FROM Applications)                                     AS TotalApplications;
GO


-- ============================================================
-- STORED PROCEDURES (business logic in SQL)
-- ============================================================

-- SP: Check if a student is eligible for a specific drive
IF OBJECT_ID('sp_CheckEligibility', 'P') IS NOT NULL DROP PROCEDURE sp_CheckEligibility;
GO
CREATE PROCEDURE sp_CheckEligibility
    @StudentID INT,
    @DriveID   INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IsEligible BIT = 0;
    DECLARE @Reason NVARCHAR(200) = '';

    -- Get student profile
    DECLARE @CGPA DECIMAL(4,2), @Branch NVARCHAR(50), @Backlogs INT;
    SELECT @CGPA = CGPA, @Branch = Branch, @Backlogs = Backlogs
    FROM StudentProfiles WHERE StudentID = @StudentID;

    IF @CGPA IS NULL
    BEGIN
        SET @Reason = 'Student profile not found. Please complete your profile first.';
        SELECT @IsEligible AS IsEligible, @Reason AS Reason;
        RETURN;
    END

    -- Get drive requirements
    DECLARE @MinCGPA DECIMAL(4,2), @MaxBacklogs INT, @AllowedBranches NVARCHAR(200);
    SELECT @MinCGPA = MinCGPA, @MaxBacklogs = MaxBacklogs, @AllowedBranches = AllowedBranches
    FROM Drives WHERE DriveID = @DriveID;

    -- Check CGPA
    IF @CGPA < @MinCGPA
    BEGIN
        SET @Reason = 'CGPA too low. Minimum required: ' + CAST(@MinCGPA AS NVARCHAR);
        SELECT @IsEligible AS IsEligible, @Reason AS Reason;
        RETURN;
    END

    -- Check backlogs
    IF @Backlogs > @MaxBacklogs
    BEGIN
        SET @Reason = 'Too many backlogs. Maximum allowed: ' + CAST(@MaxBacklogs AS NVARCHAR);
        SELECT @IsEligible AS IsEligible, @Reason AS Reason;
        RETURN;
    END

    -- Check branch (if restricted)
    IF @AllowedBranches IS NOT NULL AND @AllowedBranches != ''
    BEGIN
        IF CHARINDEX(@Branch, @AllowedBranches) = 0
        BEGIN
            SET @Reason = 'Your branch (' + @Branch + ') is not eligible for this drive.';
            SELECT @IsEligible AS IsEligible, @Reason AS Reason;
            RETURN;
        END
    END

    -- All checks passed
    SET @IsEligible = 1;
    SET @Reason = 'You are eligible for this drive!';
    SELECT @IsEligible AS IsEligible, @Reason AS Reason;
END
GO

-- SP: Get all drives a student is eligible for
IF OBJECT_ID('sp_GetEligibleDrives', 'P') IS NOT NULL DROP PROCEDURE sp_GetEligibleDrives;
GO
CREATE PROCEDURE sp_GetEligibleDrives
    @StudentID INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CGPA DECIMAL(4,2), @Branch NVARCHAR(50), @Backlogs INT;
    SELECT @CGPA = CGPA, @Branch = Branch, @Backlogs = Backlogs
    FROM StudentProfiles WHERE StudentID = @StudentID;

    SELECT
        v.*,
        CASE
            WHEN EXISTS (SELECT 1 FROM Applications a WHERE a.StudentID = @StudentID AND a.DriveID = v.DriveID)
            THEN 1 ELSE 0
        END AS AlreadyApplied
    FROM vw_DriveDetails v
    WHERE v.IsActive = 1
      AND v.MinCGPA <= ISNULL(@CGPA, 0)
      AND v.MaxBacklogs >= ISNULL(@Backlogs, 99)
      AND (v.AllowedBranches IS NULL OR v.AllowedBranches = '' OR CHARINDEX(ISNULL(@Branch,''), v.AllowedBranches) > 0);
END
GO

-- SP: Apply to a drive (checks eligibility first)
IF OBJECT_ID('sp_ApplyToDrive', 'P') IS NOT NULL DROP PROCEDURE sp_ApplyToDrive;
GO
CREATE PROCEDURE sp_ApplyToDrive
    @StudentID INT,
    @DriveID   INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Check if already applied
    IF EXISTS (SELECT 1 FROM Applications WHERE StudentID = @StudentID AND DriveID = @DriveID)
    BEGIN
        SELECT 0 AS Success, 'You have already applied to this drive.' AS Message;
        RETURN;
    END

    -- Check eligibility inline
    DECLARE @CGPA DECIMAL(4,2), @Branch NVARCHAR(50), @Backlogs INT;
    SELECT @CGPA = CGPA, @Branch = Branch, @Backlogs = Backlogs
    FROM StudentProfiles WHERE StudentID = @StudentID;

    IF @CGPA IS NULL
    BEGIN
        SELECT 0 AS Success, 'Complete your profile before applying.' AS Message;
        RETURN;
    END

    DECLARE @MinCGPA DECIMAL(4,2), @MaxBacklogs INT, @AllowedBranches NVARCHAR(200), @IsActive BIT;
    SELECT @MinCGPA = MinCGPA, @MaxBacklogs = MaxBacklogs, @AllowedBranches = AllowedBranches, @IsActive = IsActive
    FROM Drives WHERE DriveID = @DriveID;

    IF @IsActive = 0 OR @IsActive IS NULL
    BEGIN
        SELECT 0 AS Success, 'This drive is no longer active.' AS Message;
        RETURN;
    END

    IF @CGPA < @MinCGPA OR @Backlogs > @MaxBacklogs
    BEGIN
        SELECT 0 AS Success, 'You do not meet the eligibility criteria.' AS Message;
        RETURN;
    END

    IF @AllowedBranches IS NOT NULL AND @AllowedBranches != '' AND CHARINDEX(@Branch, @AllowedBranches) = 0
    BEGIN
        SELECT 0 AS Success, 'Your branch is not eligible for this drive.' AS Message;
        RETURN;
    END

    -- All good, insert application
    INSERT INTO Applications (StudentID, DriveID, Status)
    VALUES (@StudentID, @DriveID, 'Applied');

    SELECT 1 AS Success, 'Application submitted successfully!' AS Message;
END
GO


-- ============================================================
-- SEED DATA
-- ============================================================

-- Default admin
IF NOT EXISTS (SELECT * FROM Admins)
BEGIN
    INSERT INTO Admins (OperatorName, DepartmentEmail, PasswordHash, RoleLevel)
    VALUES ('SuperAdmin', 'admin@system.local', 'RootAccess123!', 5);
END
GO

-- Sample companies
IF NOT EXISTS (SELECT * FROM Companies)
BEGIN
    INSERT INTO Companies (Name, LogoInitial, LogoColor, Website) VALUES
    ('Deep Systems AI',  'D', '#6366f1', 'https://deepsystems.ai'),
    ('PayNode Global',   'P', '#f43f5e', 'https://paynode.com'),
    ('Nexus Networks',   'N', '#22d3ee', 'https://nexusnetworks.io'),
    ('Verse Realities',  'V', '#a855f7', 'https://verserealities.com');
END
GO

-- Sample drives
IF NOT EXISTS (SELECT * FROM Drives)
BEGIN
    INSERT INTO Drives (CompanyID, Role, PackageLPA, Deadline, Description, MinCGPA, MaxBacklogs, AllowedBranches) VALUES
    (1, 'Research Engineer',  35.0, '2026-10-30', 'Research engineering focused on autonomous decision systems and LLM fine-tuning.', 8.0, 0, 'CSE,IT'),
    (2, 'Backend Developer',  28.5, '2026-11-12', 'Building payment infrastructure for the next generation of fintech.',             7.5, 0, 'CSE,IT,ECE'),
    (3, 'Security Engineer',  22.0, '2026-11-15', 'Edge computing and cybersecurity. C++ and Rust experience preferred.',             7.0, 0, 'CSE,IT,ECE'),
    (4, 'Frontend Engineer',  45.0, '2026-12-01', 'Frontend and mixed-reality engineering roles. React and Three.js a plus.',         8.5, 0, 'CSE');
END
GO

PRINT 'Database setup complete!';
GO
