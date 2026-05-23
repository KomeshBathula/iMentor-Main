
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const User = require(path.join(__dirname, 'server', 'models', 'User.js'));

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27018/chatbot_autoresearch');
        const user = await User.findOne({ email: 'ultra.boy7@gmail.com' });
        if (!user) {
            console.log('User not found');
            process.exit(1);
        }
        console.log('--- CURRICULUM PROGRESS ---');
        const mlProgress = user.curriculumProgress.get('Machine Learning');
        console.log(JSON.stringify(mlProgress, null, 2));
        await mongoose.disconnect();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
