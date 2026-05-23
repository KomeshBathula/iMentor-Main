const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27018/chatbot_autoresearch')
  .then(async function() {
    const User = require('./server/models/User');
    const user = await User.findOne({email: 'test3@test.com'});
    if (user) {
      console.log('test3 isAdmin:', user.isAdmin);
      if (!user.isAdmin) {
        user.isAdmin = true;
        await user.save();
        console.log('✅ Promoted test3 to admin');
      }
    }
    process.exit(0);
  })
  .catch(function(e) { 
    console.error(e.message); 
    process.exit(1); 
  });
