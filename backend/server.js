const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dragon-gym-super-secret-key-999';

// Enable Helmet to set security headers and disable X-Powered-By
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
            "script-src-attr": ["'unsafe-inline'"],
            "connect-src": ["'self'", "http://localhost:*", "ws://localhost:*"]
        }
    }
}));

// Configure strict CORS (restrict from wildcard *)
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3000', 'http://localhost:5173', 'null', 'file://', 'capacitor://localhost', 'http://localhost']; // default local development origins

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Set request body size limits
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.static(path.join(__dirname, '../dist')));

// API Rate Limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true, 
    legacyHeaders: false, 
});

app.use('/api/', apiLimiter);

// Helper functions for crypto hashing and user sanitization
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function sanitizeUser(user) {
    if (!user) return null;
    const sanitized = { ...user };
    delete sanitized.password;
    return sanitized;
}

// --- JWT Middleware ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: "Access Denied: Missing Token" });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = decoded;
        next();
    });
}

// Secure all /api/ routes except login/register/config
app.use('/api', (req, res, next) => {
    const publicRoutes = ['/auth/login', '/auth/register', '/config'];
    if (publicRoutes.some(route => req.path.startsWith(route))) {
        return next();
    }
    return authenticateToken(req, res, next);
});

// --- API Routes ---

// 1. Authentication & Session
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email/ID and password are required" });
    }
    
    // Hash input password if not already hashed (SHA-256 hex string is 64 chars)
    let passHash = password;
    if (!/^[a-f0-9]{64}$/i.test(password)) {
        passHash = hashPassword(password);
    }

    db.get("SELECT * FROM users WHERE email = ? OR mobile = ? OR phone = ? OR customId = ? OR id = ?", 
        [email, email, email, email, email], (err, row) => {
        if (err) {
            console.error("Login Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        if (!row) return res.status(401).json({ error: "Invalid credentials" });
        
        // Verify password: check both hashed and plain text for backward compatibility
        const isMatched = (row.password === passHash) || (row.password === password);
        if (!isMatched) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign({ id: row.id, role: row.role, email: row.email }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ 
            token: token, 
            user: sanitizeUser(row) 
        });
    });
});

app.post('/api/auth/register', (req, res) => {
    const { name, email, password, role, customId } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email and password are required" });
    }
    if (password.length < 6 && !/^[a-f0-9]{64}$/i.test(password)) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    
    let passHash = password;
    if (!/^[a-f0-9]{64}$/i.test(password)) {
        passHash = hashPassword(password);
    }
    // Prevent role escalation by default. If a normal user registers, force 'member'.
    // In a real system, you'd check req.user.role here if it was authenticated.
    // For this prototype, we'll allow 'admin' ONLY IF customId is provided for the very first gym admin.
    const userRole = (role === 'admin' && customId) ? 'admin' : 'member';

    db.run("INSERT INTO users (customId, name, email, password, role) VALUES (?, ?, ?, ?, ?)", 
        [customId, name, email, passHash, userRole], function(err) {
        if (err) {
            console.error("Register Error:", err);
            if (err.message.includes("UNIQUE")) {
                return res.status(400).json({ error: "Email already exists" });
            }
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json({ message: "Registered successfully", userId: this.lastID });
    });
});

// 2. Members Management
app.get('/api/members', (req, res) => {
    db.all("SELECT * FROM users WHERE role = 'member'", [], (err, rows) => {
        if (err) {
            console.error("Get Members Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        const today = new Date();
        const updatedRows = rows.map(row => {
            const user = sanitizeUser(row);
            // Check expiry
            if (user.membershipEnd) {
                const endDate = new Date(user.membershipEnd);
                if (endDate < today) {
                    user.membershipStatus = 'Expired';
                }
            }
            return user;
        });
        res.json(updatedRows);
    });
});

app.post('/api/members', (req, res) => {
    const { name, email, password, mobile, membershipPlan, membershipStatus, membershipStart, membershipEnd } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email and password are required" });
    }
    let passHash = password;
    if (!/^[a-f0-9]{64}$/i.test(password)) {
        passHash = hashPassword(password);
    }

    db.run(`INSERT INTO users (name, email, password, role, mobile, membershipPlan, membershipStatus, membershipStart, membershipEnd) 
            VALUES (?, ?, ?, 'member', ?, ?, ?, ?, ?)`
    , [name, email, passHash, mobile, membershipPlan || 'None', membershipStatus || 'Inactive', membershipStart || '', membershipEnd || ''], function(err) {
        if (err) {
            console.error("Add Member Error:", err);
            if (err.message.includes("UNIQUE")) return res.status(400).json({ error: "Email already exists" });
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json({ message: "Member added successfully", memberId: this.lastID });
    });
});

app.put('/api/members/:id', (req, res) => {
    const fields = [];
    const params = [];

    const allowedFields = [
        'name', 'email', 'mobile', 'membershipPlan', 'membershipStatus',
        'membershipStart', 'membershipEnd', 'weight', 'height', 'address', 'assignedWorkout'
    ];

    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            fields.push(`${field} = ?`);
            params.push(req.body[field]);
        }
    });

    if (req.body.password) {
        let passHash = req.body.password;
        if (!/^[a-f0-9]{64}$/i.test(passHash)) {
            passHash = hashPassword(passHash);
        }
        fields.push(`password = ?`);
        params.push(passHash);
    }

    if (fields.length === 0) {
        return res.json({ message: "No fields to update" });
    }

    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ? AND role = 'member'`;
    params.push(req.params.id);

    db.run(query, params, function(err) {
        if (err) {
            console.error("Update Member Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json({ message: "Member updated successfully" });
    });
});

app.delete('/api/members/:id', (req, res) => {
    db.run("DELETE FROM users WHERE id = ? AND role = 'member'", [req.params.id], function(err) {
        if (err) {
            console.error("Delete Member Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json({ message: "Member deleted successfully" });
    });
});

// 3. Trainers Management
app.get('/api/trainers', (req, res) => {
    db.all("SELECT * FROM users WHERE role = 'trainer'", [], (err, rows) => {
        if (err) {
            console.error("Get Trainers Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json(rows.map(sanitizeUser));
    });
});

app.post('/api/trainers', (req, res) => {
    const { id, name, phone, email, specialization, experience, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email and password are required" });
    }
    let passHash = password;
    if (!/^[a-f0-9]{64}$/i.test(password)) {
        passHash = hashPassword(password);
    }

    db.run(`INSERT INTO users (customId, name, email, password, role, phone, specialization, experience) 
            VALUES (?, ?, ?, ?, 'trainer', ?, ?, ?)`
    , [id, name, email, passHash, phone, specialization, experience], function(err) {
        if (err) {
            console.error("Add Trainer Error:", err);
            if (err.message.includes("UNIQUE")) return res.status(400).json({ error: "Email already exists" });
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json({ message: "Trainer added successfully", id: this.lastID });
    });
});

app.put('/api/trainers/:id', (req, res) => {
    const { name, phone, email, specialization, experience, password } = req.body;
    
    let query = `UPDATE users SET name = ?, phone = ?, email = ?, specialization = ?, experience = ?`;
    let params = [name, phone, email, specialization, experience];

    if (password) {
        let passHash = password;
        if (!/^[a-f0-9]{64}$/i.test(password)) {
            passHash = hashPassword(password);
        }
        query += `, password = ?`;
        params.push(passHash);
    }

    query += ` WHERE customId = ? AND role = 'trainer'`;
    params.push(req.params.id);

    db.run(query, params, function(err) {
        if (err) {
            console.error("Update Trainer Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json({ message: "Trainer updated successfully" });
    });
});

app.delete('/api/trainers/:id', (req, res) => {
    db.run("DELETE FROM users WHERE customId = ? AND role = 'trainer'", [req.params.id], function(err) {
        if (err) {
            console.error("Delete Trainer Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json({ message: "Trainer deleted successfully" });
    });
});

// 4. Admins Management
app.get('/api/admins', (req, res) => {
    db.all("SELECT * FROM users WHERE role = 'admin'", [], (err, rows) => {
        if (err) {
            console.error("Get Admins Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json(rows.map(sanitizeUser));
    });
});

app.post('/api/admins', (req, res) => {
    const { id, name, password, isSuperAdmin } = req.body;
    if (!id || !name || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }
    let passHash = password;
    if (!/^[a-f0-9]{64}$/i.test(password)) {
        passHash = hashPassword(password);
    }

    db.run(`INSERT INTO users (customId, name, email, password, role, isSuperAdmin) 
            VALUES (?, ?, ?, ?, 'admin', ?)`
    , [id, name, id + '@admin.gym', passHash, isSuperAdmin ? 1 : 0], function(err) {
        if (err) {
            console.error("Add Admin Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json({ message: "Admin added successfully" });
    });
});

app.delete('/api/admins/:id', (req, res) => {
    db.run("DELETE FROM users WHERE customId = ? AND role = 'admin'", [req.params.id], function(err) {
        if (err) {
            console.error("Delete Admin Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json({ message: "Admin deleted successfully" });
    });
});

// 5. Bookings
app.get('/api/bookings', (req, res) => {
    db.all("SELECT * FROM bookings", [], (err, rows) => {
        if (err) {
            console.error("Get Bookings Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        // Parse machines back into array
        res.json(rows.map(r => ({
            ...r,
            machines: r.machines ? JSON.parse(r.machines) : []
        })));
    });
});

app.post('/api/bookings', (req, res) => {
    const { id, memberEmail, date, session, machine, machines, time, status } = req.body;
    if (!id || !memberEmail || !date || !session || !time) {
        return res.status(400).json({ error: "Missing required booking details" });
    }
    
    const machinesStr = JSON.stringify(machines || []);
    db.run(`INSERT INTO bookings (id, memberEmail, date, session, machine, machines, time, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    , [id, memberEmail, date, session, machine || '', machinesStr, time, status || 'Booked'], function(err) {
        if (err) {
            console.error("Create Booking Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json({ message: "Booking confirmed", bookingId: id });
    });
});

app.delete('/api/bookings/:id', (req, res) => {
    db.run("DELETE FROM bookings WHERE id = ?", [req.params.id], function(err) {
        if (err) {
            console.error("Delete Booking Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json({ message: "Booking cancelled successfully" });
    });
});

app.put('/api/bookings/:id/status', (req, res) => {
    const { status } = req.body;
    db.run("UPDATE bookings SET status = ? WHERE id = ?", [status, req.params.id], function(err) {
        if (err) {
            console.error("Update Booking Status Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json({ message: "Booking status updated" });
    });
});

// 6. Payments
app.get('/api/payments', (req, res) => {
    db.all("SELECT * FROM payments", [], (err, rows) => {
        if (err) {
            console.error("Get Payments Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json(rows);
    });
});

app.post('/api/payments', (req, res) => {
    const { id, memberEmail, memberName, amount, plan, date, method, status } = req.body;
    if (!id || !memberEmail || !memberName || !amount || !plan || !method || !status) {
        return res.status(400).json({ error: "Missing payment fields" });
    }

    db.run(`INSERT INTO payments (id, memberEmail, memberName, amount, plan, date, method, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    , [id, memberEmail, memberName, amount, plan, date, method, status], function(err) {
        if (err) {
            console.error("Record Payment Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json({ message: "Payment recorded successfully", paymentId: id });
    });
});

// 7. Workout Assignments
app.get('/api/workouts', (req, res) => {
    db.all("SELECT * FROM workout_assignments", [], (err, rows) => {
        if (err) {
            console.error("Get Workouts Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json(rows);
    });
});

app.post('/api/workouts', (req, res) => {
    const { id, memberId, trainerId, trainerName, workoutType, workoutDetails, exercises, setsReps, duration, notes, date, status } = req.body;
    
    db.run(`INSERT OR REPLACE INTO workout_assignments (id, memberId, trainerId, trainerName, workoutType, workoutDetails, exercises, setsReps, duration, notes, date, status, updatedAt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    , [id, memberId, trainerId, trainerName, workoutType, workoutDetails, exercises, setsReps, duration, notes, date, status || 'Pending', new Date().toISOString()], function(err) {
        if (err) {
            console.error("Save Workout Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json({ message: "Workout routine assigned successfully" });
    });
});

app.put('/api/workouts/:id/status', (req, res) => {
    const { status } = req.body;
    db.run("UPDATE workout_assignments SET status = ?, updatedAt = ? WHERE id = ?", 
        [status, new Date().toISOString(), req.params.id], function(err) {
        if (err) {
            console.error("Toggle Workout Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json({ message: "Workout status updated" });
    });
});

// 8. Notifications
app.get('/api/notifications', (req, res) => {
    db.all("SELECT * FROM notifications", [], (err, rows) => {
        if (err) {
            console.error("Get Notifications Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json(rows);
    });
});

app.post('/api/notifications', (req, res) => {
    const { id, memberId, title, message, workoutId, trainerName, workoutDetails, workoutType, date, createdAt } = req.body;
    
    db.run(`INSERT INTO notifications (id, memberId, title, message, workoutId, trainerName, workoutDetails, workoutType, date, createdAt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    , [id, memberId, title, message, workoutId, trainerName, workoutDetails, workoutType, date, createdAt || new Date().toISOString()], function(err) {
        if (err) {
            console.error("Create Notification Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json({ message: "Notification created successfully" });
    });
});

// 9. Config
app.get('/api/config', (req, res) => {
    db.get("SELECT * FROM config WHERE key = 'gymName'", [], (err, row) => {
        if (err) {
            console.error("Get Config Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json({ gymName: row ? row.value : 'Dragon Gym' });
    });
});

app.post('/api/config', (req, res) => {
    const { gymName } = req.body;
    if (!gymName) {
        return res.status(400).json({ error: "gymName is required" });
    }
    db.run("INSERT OR REPLACE INTO config (key, value) VALUES ('gymName', ?)", [gymName], function(err) {
        if (err) {
            console.error("Update Config Error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json({ message: "Config updated" });
    });
});

// Fallback: send the main HTML index.html for page reloads
app.get('*any', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
