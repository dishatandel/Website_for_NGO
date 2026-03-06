const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rotary_honavar', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log('MongoDB Error:', err));

// Import schemas
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String,
  createdAt: { type: Date, default: Date.now }
});

const projectSchema = new mongoose.Schema({
  title: String,
  description: String,
  image: String,
  category: String,
  date: { type: Date, default: Date.now }
});

const eventSchema = new mongoose.Schema({
  title: String,
  description: String,
  date: Date,
  type: String,
  location: String,
  createdAt: { type: Date, default: Date.now }
});

const leaderSchema = new mongoose.Schema({
  name: String,
  position: String,
  image: String,
  year: String,
  order: Number
});

// Models
const User = mongoose.model('User', userSchema);
const Project = mongoose.model('Project', projectSchema);
const Event = mongoose.model('Event', eventSchema);
const Leader = mongoose.model('Leader', leaderSchema);

// Seed data
const seedDatabase = async () => {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Project.deleteMany({});
    await Event.deleteMany({});
    await Leader.deleteMany({});

    console.log('Existing data cleared');

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@rotaryhonavar.org',
      password: hashedPassword,
      role: 'admin'
    });

    console.log('Admin user created:', admin.email);

    // Create sample projects
    const projects = await Project.insertMany([
      {
        title: 'Community Service Drive',
        description: 'Organizing local clean-up events and food distribution programs to support underprivileged families in our community.',
        category: 'ongoing',
        image: '/uploads/placeholder-project1.jpg'
      },
      {
        title: 'Education and Literacy',
        description: 'Providing scholarships and school supplies to underprivileged students to promote education and literacy.',
        category: 'ongoing',
        image: '/uploads/placeholder-project2.jpg'
      },
      {
        title: 'Health Awareness Camps',
        description: 'Hosting free medical check-ups and health education workshops for community members.',
        category: 'ongoing',
        image: '/uploads/placeholder-project3.jpg'
      },
      {
        title: 'Pink Rickshaw Donation',
        description: 'Empowered women by providing pink rickshaws as a source of livelihood and safe transport.',
        category: 'past',
        image: '/uploads/placeholder-project4.jpg'
      },
      {
        title: 'Local Road Repair',
        description: 'Contributed to local infrastructure by repairing critical roads in the community.',
        category: 'past',
        image: '/uploads/placeholder-project5.jpg'
      }
    ]);

    console.log(`${projects.length} projects created`);

    // Create sample events
    const events = await Event.insertMany([
      {
        title: 'Annual Blood Donation Camp',
        description: 'Join us at the Town Hall to save lives. 9 AM - 4 PM.',
        date: new Date('2025-10-05'),
        type: 'upcoming',
        location: 'Town Hall, Honavar'
      },
      {
        title: 'Charity Gala Dinner',
        description: 'A fundraising event for our upcoming literacy projects.',
        date: new Date('2025-11-12'),
        type: 'upcoming',
        location: 'Rotary Hall'
      },
      {
        title: 'Successful Tree Plantation Drive',
        description: 'We planted over 500 saplings near the Sharavathi river bank.',
        date: new Date('2025-09-01'),
        type: 'news',
        location: 'Sharavathi River Bank'
      },
      {
        title: 'Scholarship Distribution Ceremony',
        description: '25 deserving students received scholarships for higher education.',
        date: new Date('2025-08-15'),
        type: 'news',
        location: 'Community Center'
      }
    ]);

    console.log(`${events.length} events created`);

    // Create leadership team
    const leaders = await Leader.insertMany([
      {
        name: 'Rtn. Rajesh Kumar',
        position: 'President',
        year: '2025-2026',
        order: 1,
        image: '/uploads/placeholder-leader1.jpg'
      },
      {
        name: 'Rtn. Priya Shetty',
        position: 'Secretary',
        year: '2025-2026',
        order: 2,
        image: '/uploads/placeholder-leader2.jpg'
      },
      {
        name: 'Rtn. Suresh Nayak',
        position: 'Treasurer',
        year: '2025-2026',
        order: 3,
        image: '/uploads/placeholder-leader3.jpg'
      },
      {
        name: 'Rtn. Anjali Rao',
        position: 'Club Service Director',
        year: '2025-2026',
        order: 4,
        image: '/uploads/placeholder-leader4.jpg'
      }
    ]);

    console.log(`${leaders.length} leaders created`);

    console.log('\n=== Seed Data Summary ===');
    console.log(`Admin Email: ${admin.email}`);
    console.log('Admin Password: admin123');
    console.log(`Projects: ${projects.length}`);
    console.log(`Events: ${events.length}`);
    console.log(`Leaders: ${leaders.length}`);
    console.log('========================\n');

    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();