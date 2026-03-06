const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use(express.static(__dirname));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rotary_honavar', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log('MongoDB Error:', err));

// File Upload Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed!'));
    }
});

// Schemas
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'member', 'pending'], default: 'pending' }, // Role can be member or pending
    membershipEndDate: { type: Date, default: null }, // NEW FIELD
    tasks: [ // NEW FIELD for assigned work
        {
            title: String,
            project: String,
            dueDate: String,
            completed: { type: Boolean, default: false }
        }
    ],
    createdAt: { type: Date, default: Date.now }
});

const projectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String },
    category: { type: String, enum: ['ongoing', 'past'], required: true },
    date: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const eventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: Date, required: true },
    type: { type: String, enum: ['upcoming', 'news'], required: true },
    location: String,
    createdAt: { type: Date, default: Date.now }
});

const contactSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ['new', 'read', 'replied'], default: 'new' },
    createdAt: { type: Date, default: Date.now }
});

const membershipSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    profession: { type: String, required: true },
    message: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

const leaderSchema = new mongoose.Schema({
    name: { type: String, required: true },
    position: { type: String, required: true },
    image: { type: String },
    year: { type: String, required: true },
    order: { type: Number, default: 0 }
});

const serviceRequestSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    location: { type: String, required: true },
    issue: { type: String, required: true },
    status: { type: String, enum: ['new', 'under review', 'action taken', 'rejected'], default: 'new' },
    createdAt: { type: Date, default: Date.now }
});


// Models
const User = mongoose.model('User', userSchema);
const Project = mongoose.model('Project', projectSchema);
const Event = mongoose.model('Event', eventSchema);
const Contact = mongoose.model('Contact', contactSchema);
const Membership = mongoose.model('Membership', membershipSchema);
const Leader = mongoose.model('Leader', leaderSchema);
const ServiceRequest = mongoose.model('ServiceRequest', serviceRequestSchema);

// Middleware for JWT verification
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'No token, authorization denied' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'rotary_secret_key_2025');
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token is not valid' });
    }
};

// Admin middleware
const adminMiddleware = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    next();
};

// ==================== AUTH ROUTES ====================

// Register: User registration for membership/tracking
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        // Role is implicitly 'pending' by default in the schema

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered. Please log in.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            name,
            email,
            password: hashedPassword,
            role: 'pending' // Enforce pending role on initial registration
        });

        await user.save();

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'rotary_secret_key_2025',
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // If user is neither admin nor member, block access (Pending users still get token for tracking)
        if (user.role !== 'admin' && user.role !== 'member' && user.role !== 'pending') {
             return res.status(403).json({ error: 'Account access denied.' });
        }

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'rotary_secret_key_2025',
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get current user (MODIFIED to include tasks and expiry)
app.get('/api/auth/me', authMiddleware, async (req, res) => {
    // Select all user fields including the new ones
    const user = await User.findById(req.user.id).select('-password'); 
    if (!user) {
         return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
});

// ==================== PROJECT ROUTES (Unchanged) ====================

app.get('/api/projects', async (req, res) => {
    try {
        const { category } = req.query;
        const filter = category ? { category } : {};
        const projects = await Project.find(filter).sort({ date: -1 });
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/projects/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json(project);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/projects', authMiddleware, adminMiddleware, upload.single('image'), async (req, res) => {
    try {
        const { title, description, category } = req.body;
        
        const project = new Project({
            title,
            description,
            category,
            image: req.file ? `/uploads/${req.file.filename}` : null,
            createdBy: req.user._id
        });

        await project.save();
        res.status(201).json(project);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/projects/:id', authMiddleware, adminMiddleware, upload.single('image'), async (req, res) => {
    try {
        const { title, description, category } = req.body;
        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (category !== undefined) updateData.category = category;
        
        if (req.file) {
            updateData.image = `/uploads/${req.file.filename}`;
        }

        const project = await Project.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json(project);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/projects/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const project = await Project.findByIdAndDelete(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json({ message: 'Project deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== EVENT ROUTES (Unchanged) ====================

app.get('/api/events', async (req, res) => {
    try {
        const { type } = req.query;
        const filter = type ? { type } : {};
        const events = await Event.find(filter).sort({ date: -1 });
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/events', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const event = new Event(req.body);
        await event.save();
        res.status(201).json(event);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/events/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        res.json(event);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/events/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== CONTACT ROUTES (Unchanged) ====================

app.post('/api/contact', async (req, res) => {
    try {
        const contact = new Contact(req.body);
        await contact.save();
        res.status(201).json({ message: 'Message sent successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/contacts', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const contacts = await Contact.find().sort({ createdAt: -1 });
        res.json(contacts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/contacts/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        const contact = await Contact.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        if (!contact) {
            return res.status(404).json({ error: 'Contact not found' });
        }
        res.json(contact);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== MEMBERSHIP ROUTES ====================

app.post('/api/membership', async (req, res) => {
    try {
        const membership = new Membership(req.body);
        await membership.save();
        res.status(201).json({ message: 'Membership request submitted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/membership', authMiddleware, async (req, res) => {
    try {
        // Allows both admins and authenticated members (for tracking) to see applications
        const memberships = await Membership.find().sort({ createdAt: -1 });
        res.json(memberships);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update membership status (Admin only) - MODIFIED to update User role and expiry
app.patch('/api/membership/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        const membership = await Membership.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        if (!membership) {
            return res.status(404).json({ error: 'Membership request not found' });
        }

        // CRITICAL LOGIC: If approved, update the User role and set expiry date (1 year from now)
        if (status === 'approved') {
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);

            await User.findOneAndUpdate(
                { email: membership.email },
                { role: 'member', membershipEndDate: expiryDate },
                { new: true }
            );
        } else if (status === 'rejected') {
             // Reset role to pending if previously approved but status changed later
             await User.findOneAndUpdate(
                { email: membership.email },
                { role: 'pending', membershipEndDate: null },
                { new: true }
            );
        }

        res.json(membership);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== LEADER ROUTES (Unchanged) ====================

app.get('/api/leaders', async (req, res) => {
    try {
        const leaders = await Leader.find().sort({ order: 1 });
        res.json(leaders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/leaders', authMiddleware, adminMiddleware, upload.single('image'), async (req, res) => {
    try {
        const { name, position, year, order } = req.body;
        
        const leader = new Leader({
            name,
            position,
            year,
            order,
            image: req.file ? `/uploads/${req.file.filename}` : null
        });

        await leader.save();
        res.status(201).json(leader);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== SERVICE REQUEST ROUTES ====================

app.post('/api/servicerequest', async (req, res) => {
    try {
        const serviceRequest = new ServiceRequest(req.body);
        await serviceRequest.save();
        res.status(201).json({ message: 'Service request submitted successfully! We will review it shortly.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/servicerequests', authMiddleware, async (req, res) => {
    try {
        // NOTE: This route is authenticated for admin/member access for tracking/management
        const requests = await ServiceRequest.find().sort({ createdAt: -1 });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/servicerequests/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        const request = await ServiceRequest.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        if (!request) {
            return res.status(404).json({ error: 'Service request not found' });
        }
        res.json(request);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== STATISTICS ROUTES (Unchanged) ====================

app.get('/api/stats', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const projectCount = await Project.countDocuments();
        const eventCount = await Event.countDocuments({ type: 'upcoming' });
        const membershipCount = await Membership.countDocuments({ status: 'pending' });
        const contactCount = await Contact.countDocuments({ status: 'new' });
        const serviceRequestCount = await ServiceRequest.countDocuments({ status: 'new' });

        res.json({
            projects: projectCount,
            upcomingEvents: eventCount,
            pendingMemberships: membershipCount,
            newContacts: contactCount,
            newServiceRequests: serviceRequestCount 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
