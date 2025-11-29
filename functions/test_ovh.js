const nodemailer = require('nodemailer');

console.log('Testing connection to ssl0.ovh.net...');

const transporter = nodemailer.createTransport({
    host: 'ssl0.ovh.net',
    port: 465,
    secure: true, // true for 465
    auth: {
        user: 'postmaster@cyber-threat-consulting.com',
        pass: 'Al21689a!'
    },
    debug: true // show debug output
});

transporter.verify(function (error, success) {
    if (error) {
        console.log('❌ Connection failed!');
        console.error(error);
    } else {
        console.log('✅ Connection successful! Server is ready to take our messages.');
    }
});
