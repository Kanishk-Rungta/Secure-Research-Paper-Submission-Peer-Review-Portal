const mongoose = require('mongoose');
const Paper = require('./models/Paper');
const User = require('./models/User');
require('dotenv').config();

async function checkDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/research-portal', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✓ Connected to MongoDB');

    // Check users
    const userCount = await User.countDocuments();
    console.log(`📊 Users in database: ${userCount}`);

    // Check papers
    const paperCount = await Paper.countDocuments();
    console.log(`📄 Papers in database: ${paperCount}`);

    if (paperCount === 0) {
      console.log('⚠️  No papers found in database. This is likely why the dashboard shows no papers.');
      
      // Get first user to create test paper
      const firstUser = await User.findOne();
      if (firstUser) {
        console.log(`👤 Found user: ${firstUser.fullName} (${firstUser.role})`);
        
        // Create a test paper
        const testPaper = new Paper({
          title: 'Test Research Paper for Dashboard Display',
          abstractText: 'This is a test abstract to verify that the paper display functionality is working correctly in the dashboard. The paper should appear in the author dashboard when logged in.',
          keywords: ['test', 'research', 'dashboard'],
          fileName: 'test-paper.pdf',
          fileSize: 1024000,
          encryptedData: 'dGVzdCBlbmNyeXB0ZWQgZGF0YQ==', // base64 encoded test data
          encryptedIV: 'dGVzdCBpdiBkYXRh', // base64 encoded test IV
          encryptedAESKey: 'dGVzdCBlbmNyeXB0ZWQgYWVzIGtleQ==', // base64 encoded test key
          fileHash: 'test-hash-value',
          authorId: firstUser._id,
          authorEmail: firstUser.email,
          status: 'SUBMITTED',
        });

        await testPaper.save();
        console.log('✅ Test paper created successfully!');
        console.log(`📄 Paper ID: ${testPaper._id}`);
        console.log(`📝 Paper Title: ${testPaper.title}`);
      } else {
        console.log('❌ No users found. Please register a user first.');
      }
    } else {
      console.log('✅ Papers exist in database. The issue might be elsewhere.');
      
      // Show first few papers
      const papers = await Paper.find().limit(3).populate('authorId', 'fullName email');
      papers.forEach((paper, index) => {
        console.log(`\n📄 Paper ${index + 1}:`);
        console.log(`   Title: ${paper.title}`);
        console.log(`   Author: ${paper.authorId?.fullName || 'Unknown'}`);
        console.log(`   Status: ${paper.status}`);
        console.log(`   Submitted: ${paper.submittedAt}`);
      });
    }

    await mongoose.connection.close();
    console.log('\n✓ Database check completed');
  } catch (error) {
    console.error('❌ Database check error:', error);
  }
}

checkDatabase();
