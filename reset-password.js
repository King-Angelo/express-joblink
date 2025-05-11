require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function resetPassword() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Find the jobseeker by ID
        const jobseekerId = '68207fa0e98f92db91f59d02';
        const newPassword = 'jobseeker123';

        const jobseeker = await User.findOne({ _id: jobseekerId, userType: 'jobseeker' });
        if (!jobseeker) {
            console.log('Jobseeker not found');
            return;
        }

        console.log('Found jobseeker:', {
            id: jobseeker._id,
            email: jobseeker.email,
            userType: jobseeker.userType,
            currentPassword: jobseeker.password
        });

        // Set the plain password - the pre-save middleware will hash it
        jobseeker.password = newPassword;
        await jobseeker.save();

        // Verify the update
        const updatedJobseeker = await User.findOne({ _id: jobseekerId });
        console.log('Updated jobseeker password:', updatedJobseeker.password);

        console.log('Password reset successfully');
        console.log('New password:', newPassword);
        console.log('Email:', jobseeker.email); // Log the email so you know which account was updated
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

resetPassword(); 