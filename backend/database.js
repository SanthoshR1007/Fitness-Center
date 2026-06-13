const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const dbPath = path.resolve(__dirname, 'gym.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        // Helper function for SHA-256 hashing
        function hashPassword(password) {
            return crypto.createHash('sha256').update(password).digest('hex');
        }

        // Initialize tables
        db.serialize(() => {
            // Users table (covers Members, Trainers, Admins)
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customId TEXT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'member',
                height TEXT,
                weight TEXT,
                address TEXT,
                mobile TEXT,
                phone TEXT,
                assignedWorkout TEXT DEFAULT 'None',
                membershipPlan TEXT DEFAULT 'None',
                membershipStatus TEXT DEFAULT 'Inactive',
                membershipStart TEXT,
                membershipEnd TEXT,
                specialization TEXT,
                experience TEXT,
                isSuperAdmin INTEGER DEFAULT 0,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Check and add missing columns if users table already existed
            const columnsToVerify = [
                { name: 'customId', type: 'TEXT' },
                { name: 'mobile', type: 'TEXT' },
                { name: 'phone', type: 'TEXT' },
                { name: 'assignedWorkout', type: "TEXT DEFAULT 'None'" },
                { name: 'membershipPlan', type: "TEXT DEFAULT 'None'" },
                { name: 'membershipStatus', type: "TEXT DEFAULT 'Inactive'" },
                { name: 'membershipStart', type: 'TEXT' },
                { name: 'membershipEnd', type: 'TEXT' },
                { name: 'specialization', type: 'TEXT' },
                { name: 'experience', type: 'TEXT' },
                { name: 'isSuperAdmin', type: 'INTEGER DEFAULT 0' }
            ];

            db.all("PRAGMA table_info(users)", (err, info) => {
                if (err) {
                    console.error("Error reading table_info", err);
                    return;
                }
                const existingColumns = info.map(col => col.name);
                columnsToVerify.forEach(col => {
                    if (!existingColumns.includes(col.name)) {
                        db.run(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`, (err) => {
                            if (err) console.error(`Error adding column ${col.name}:`, err);
                            else console.log(`Column ${col.name} added successfully.`);
                        });
                    }
                });
            });

            // Recreate bookings table to match the new schema with custom string IDs
            db.run(`CREATE TABLE IF NOT EXISTS bookings (
                id TEXT PRIMARY KEY,
                memberEmail TEXT NOT NULL,
                date TEXT NOT NULL,
                session TEXT NOT NULL,
                machine TEXT NOT NULL,
                machines TEXT NOT NULL,
                time TEXT NOT NULL,
                status TEXT DEFAULT 'Booked',
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Config table
            db.run(`CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )`);

            // Payments table
            db.run(`CREATE TABLE IF NOT EXISTS payments (
                id TEXT PRIMARY KEY,
                memberEmail TEXT NOT NULL,
                memberName TEXT NOT NULL,
                amount REAL NOT NULL,
                plan TEXT NOT NULL,
                date TEXT NOT NULL,
                method TEXT NOT NULL,
                status TEXT NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Workout assignments table
            db.run(`CREATE TABLE IF NOT EXISTS workout_assignments (
                id TEXT PRIMARY KEY,
                memberId TEXT NOT NULL,
                trainerId TEXT,
                trainerName TEXT,
                workoutType TEXT,
                workoutDetails TEXT,
                exercises TEXT,
                setsReps TEXT,
                duration TEXT,
                notes TEXT,
                date TEXT,
                status TEXT DEFAULT 'Pending',
                updatedAt TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Notifications table
            db.run(`CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                memberId TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                workoutId TEXT,
                trainerName TEXT,
                workoutDetails TEXT,
                workoutType TEXT,
                date TEXT,
                createdAt TEXT
            )`);
            
            // Insert default config if empty
            db.get("SELECT count(*) as count FROM config", [], (err, row) => {
                if (row && row.count === 0) {
                    db.run("INSERT INTO config (key, value) VALUES ('gymName', 'Dragon Gym')");
                }
            });
            
            // Seed members, trainers, admins and payments if empty
            db.get("SELECT count(*) as count FROM users", [], (err, row) => {
                if (row && row.count === 0) {
                    console.log("Seeding database with demo data...");
                    
                    // 1. Seed Super Admin
                    const adminPass = hashPassword('20062331');
                    db.run(`INSERT INTO users (customId, name, email, password, role, isSuperAdmin) 
                            VALUES ('9345557845', 'Super Admin', 'admin@gym.com', ?, 'admin', 1)`, [adminPass]);

                    // 2. Seed Trainers
                    const trainers = [
                        { id: 'T001', name: 'Rajan Verma', phone: '9876500001', email: 'rajan@gym.com', specialization: 'Strength & Conditioning', experience: '8 years' },
                        { id: 'T002', name: 'Priya Sharma', phone: '9876500002', email: 'priya@gym.com', specialization: 'Yoga & Flexibility', experience: '5 years' },
                        { id: 'T003', name: 'Arjun Nair', phone: '9876500003', email: 'arjun@gym.com', specialization: 'CrossFit & HIIT', experience: '6 years' },
                        { id: 'T004', name: 'Meena Pillai', phone: '9876500004', email: 'meena@gym.com', specialization: 'Cardio & Weight Loss', experience: '4 years' },
                        { id: 'T005', name: 'Vikram Bose', phone: '9876500005', email: 'vikram@gym.com', specialization: 'Bodybuilding & Nutrition', experience: '10 years' }
                    ];
                    
                    const trainerPass = hashPassword('1234');
                    trainers.forEach(t => {
                        db.run(`INSERT INTO users (customId, name, email, password, role, phone, specialization, experience) 
                                VALUES (?, ?, ?, ?, 'trainer', ?, ?, ?)`
                        , [t.id, t.name, t.email, trainerPass, t.phone, t.specialization, t.experience]);
                    });

                    // 3. Seed Members
                    const memberNames = [
                        'Arun Kumar', 'Karthik Raj', 'Vignesh S', 'Praveen Kumar', 'Sathish Kumar',
                        'Dinesh Babu', 'Gokul Raj', 'Harish Kumar', 'Naveen Kumar', 'Ramesh Kumar',
                        'Suresh Babu', 'Ganesh Kumar', 'Vijay Kumar', 'Ajith Kumar', 'Saravanan M',
                        'Madhan Kumar', 'Prakash Raj', 'Murugan K', 'Senthil Kumar', 'Manikandan R',
                        'Bala Murugan', 'Raja Sekar', 'Ashwin Kumar', 'Deepak Kumar', 'Hari Prasad',
                        'Kishore Kumar', 'Lokesh Kumar', 'Muthu Kumar', 'Nandha Kumar', 'Prasanth Kumar',
                        'Rahul Kumar', 'Santhosh R', 'Sanjay Kumar', 'Selva Kumar', 'Siva Kumar',
                        'Sridhar R', 'Sudhakar K', 'Tharun Kumar', 'Uday Kumar', 'Varun Kumar',
                        'Vasanth Kumar', 'Vinoth Kumar', 'Yogesh Kumar', 'Aravind Kumar', 'Bharath Kumar',
                        'Chandru Kumar', 'Elango Kumar', 'Jegan Kumar', 'Kamal Kumar', 'Kavin Kumar'
                    ];

                    const memberPass = hashPassword('1234');
                    const paymentsList = [];
                    
                    memberNames.forEach((name, i) => {
                        const email = `${name.toLowerCase().replace(' ', '.')}@gmail.com`;
                        const mobile = '987654321' + i;
                        
                        let plan = 'None';
                        let status = 'Inactive';
                        let start = '';
                        let end = '';

                        if (i % 5 !== 0) {
                            plan = i % 3 === 0 ? 'Quarterly' : (i % 7 === 0 ? 'Yearly' : 'Monthly');
                            status = i % 10 === 0 ? 'Expired' : 'Active';
                            start = '2026-05-01';
                            end = status === 'Expired' ? '2026-06-01' : (plan === 'Monthly' ? '2026-06-15' : (plan === 'Quarterly' ? '2026-08-01' : '2027-05-01'));
                        }

                        // Insert user and obtain auto-generated ID for payments linking if needed,
                        // but payments use email as foreign key.
                        db.run(`INSERT INTO users (name, email, password, role, mobile, membershipPlan, membershipStatus, membershipStart, membershipEnd) 
                                VALUES (?, ?, ?, 'member', ?, ?, ?, ?, ?)`
                        , [name, email, memberPass, mobile, plan, status, start, end], function(err) {
                            if (err) {
                                console.error(`Error seeding member ${name}:`, err.message);
                                return;
                            }
                            
                            // Seed payment record for this user if they have a membership plan
                            if (plan !== 'None') {
                                const amount = plan === 'Monthly' ? 50 : (plan === 'Quarterly' ? 120 : (plan === 'Half-Yearly' ? 200 : 350));
                                const payStatus = status === 'Active' ? 'Paid' : 'Pending';
                                const paymentId = 'PM' + (100000 + i);
                                
                                db.run(`INSERT INTO payments (id, memberEmail, memberName, amount, plan, date, method, status) 
                                        VALUES (?, ?, ?, ?, ?, '2026-05-01', 'UPI', ?)`
                                , [paymentId, email, name, amount, plan, payStatus], (pErr) => {
                                    if (pErr) console.error("Error seeding payment:", pErr.message);
                                });
                            }
                        });
                    });
                }
            });
        });
    }
});

module.exports = db;
