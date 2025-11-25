const nodemailer = require('nodemailer');

const smtpConfig = {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'contact@cyber-threat-consulting.com',
        pass: 'recw qbmo dwke twud'
    }
};

async function testEmail() {
    console.log('Testing SMTP connection...');
    const transporter = nodemailer.createTransport(smtpConfig);

    try {
        await transporter.verify();
        console.log('SMTP Connection Verified!');

        console.log('Sending test email...');
        const info = await transporter.sendMail({
            from: '"Sentinel GRC Test" <contact@cyber-threat-consulting.com>',
            to: 'thibault.llopis@gmail.com',
            subject: 'Test Verification SMTP',
            html: '<h1>SMTP Works!</h1><p>Credentials are valid.</p>'
        });

        console.log('Message sent: %s', info.messageId);
    } catch (error) {
        console.error('SMTP Error:', error);
    }
}

testEmail();
