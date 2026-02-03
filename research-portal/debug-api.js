const mongoose = require('mongoose');
const Paper = require('./models/Paper');
const User = require('./models/User');
require('dotenv').config();

async function debugAPICall() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/research-portal', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✓ Connected to MongoDB');

    // Get all users to simulate different roles
    const users = await User.find({});
    console.log(`👤 Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`   - ${user.fullName} (${user.role}) - ID: ${user._id}`);
    });

    // Get all papers
    const allPapers = await Paper.find({})
      .select('-encryptedData -encryptedAESKey -encryptedIV -fileHash')
      .populate('authorId', 'fullName email institution')
      .populate('assignedReviewers', 'fullName email')
      .sort({ submittedAt: -1 });

    console.log(`\n📄 Found ${allPapers.length} papers in database:`);
    allPapers.forEach((paper, index) => {
      console.log(`\n   Paper ${index + 1}:`);
      console.log(`   - ID: ${paper._id}`);
      console.log(`   - Title: ${paper.title}`);
      console.log(`   - Author: ${paper.authorId?.fullName || 'Unknown'} (${paper.authorId?._id})`);
      console.log(`   - Status: ${paper.status}`);
      console.log(`   - Submitted: ${paper.submittedAt}`);
    });

    // Simulate API call for each user role
    for (const user of users) {
      console.log(`\n\n=== Simulating API call for ${user.fullName} (${user.role}) ===`);
      
      let query = {};
      if (user.role === 'Author') {
        query = { authorId: user._id };
        console.log(`Author query:`, query);
      } else if (user.role === 'Reviewer') {
        query = {}; // all papers
        console.log(`Reviewer query:`, query);
      } else if (user.role === 'Editor') {
        // For editors, we need to check PaperAccess (but let's see all papers first)
        query = {}; // temporarily show all to debug
        console.log(`Editor query (temporarily all):`, query);
      }

      const userPapers = await Paper.find(query)
        .select('-encryptedData -encryptedAESKey -encryptedIV -fileHash')
        .populate('authorId', 'fullName email institution')
        .populate('assignedReviewers', 'fullName email')
        .sort({ submittedAt: -1 });

      console.log(`📊 Papers ${user.role} would see: ${userPapers.length}`);
      userPapers.forEach((paper, index) => {
        console.log(`   ${index + 1}. ${paper.title} - by ${paper.authorId?.fullName || 'Unknown'}`);
      });
    }

    await mongoose.connection.close();
    console.log('\n✓ Debug completed');
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugAPICall();
