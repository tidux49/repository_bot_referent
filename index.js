const { Client, Intents } = require('discord.js');
const fs = require('fs');
const pdf = require('pdfkit');
require('dotenv').config();
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MEMBERS] });

const token = process.env.DISCORD_TOKEN;
const roleToTrack = 'referent';
const notificationRole = 'coordo_acceuil';
const channelToTrack = 'référents';

let userMessageTracker = new Map();
let messageData = []; // Store messages for PDF generation

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    // Initialize the tracker
    initializeTracker();
});

client.on('messageCreate', async (message) => {
    if (message.channel.id === channelToTrack) {
        let member = message.member;
        if (member.roles.cache.has(roleToTrack) && message.content.startsWith('bilan ')) {
            let name = message.content.split(' ')[1]; // Extract name after "bilan"
            userMessageTracker.set(member.id, true);
            messageData.push({ name: name, content: message.content });
            checkAllMembersMessaged();
        }
    }

    // Command to simulate end of the month
    if (message.content === '!simulateEndOfMonth') {
        simulateEndOfMonth(message.channel);
    }

    // Command to generate PDF
    if (message.content === '!generatePDF') {
        generatePDF(message.channel);
    }
});

async function initializeTracker() {
    let guild = client.guilds.cache.first();
    let role = guild.roles.cache.get(roleToTrack);
    role.members.each(member => {
        userMessageTracker.set(member.id, false);
    });
}

async function checkAllMembersMessaged() {
    let allMessaged = true;
    for (let [_, hasMessaged] of userMessageTracker) {
        if (!hasMessaged) {
            allMessaged = false;
            break;
        }
    }
    if (allMessaged) {
        notifyRole();
    }
}

function notifyRole() {
    let guild = client.guilds.cache.first();
    let role = guild.roles.cache.get(notificationRole);
    let channel = guild.channels.cache.get(channelToTrack);
    channel.send(`Hey ${role}, all members of the role have sent a message this month!`);
    // Reset the tracker
    userMessageTracker.forEach((_, key) => userMessageTracker.set(key, false));
    // Clear message data
    messageData = [];
}

function remindUnmessagedMembers() {
    let guild = client.guilds.cache.first();
    let role = guild.roles.cache.get(notificationRole);
    let channel = guild.channels.cache.get(channelToTrack);
    let unmessagedMembers = [];

    userMessageTracker.forEach((hasMessaged, userId) => {
        if (!hasMessaged) {
            unmessagedMembers.push(`<@${userId}>`);
        }
    });

    if (unmessagedMembers.length > 0) {
        channel.send(`Hey ${role}, the following members haven't sent a message yet this month: ${unmessagedMembers.join(', ')}`);
    }
}

// Check for unmessaged members every week
setInterval(remindUnmessagedMembers, 7 * 24 * 60 * 60 * 1000);

// Reset the tracker every month
setInterval(() => {
    userMessageTracker.forEach((_, key) => userMessageTracker.set(key, false));
    messageData = []; // Clear message data
}, 30 * 24 * 60 * 60 * 1000);

// Simulate end of the month for testing purposes
function simulateEndOfMonth(channel) {
    remindUnmessagedMembers();
    notifyRole();
    channel.send('End of month simulation complete.');
}

// Generate PDF from collected messages
function generatePDF(channel) {
    // Sort message data by name
    messageData.sort((a, b) => a.name.localeCompare(b.name));

    // Get current month and year
    const now = new Date();
    const month = now.getMonth() + 1; // getMonth() returns 0-11
    const year = now.getFullYear();
    const fileName = `contact_${month}_${year}.pdf`;

    // Create a PDF document
    const doc = new pdf();
    const writeStream = fs.createWriteStream(fileName);
    doc.pipe(writeStream);

    // Add title
    doc.fontSize(20).text('Bilan Messages', { align: 'center' });
    doc.moveDown();

    // Add messages
    messageData.forEach(data => {
        doc.fontSize(14).text(data.name);
        doc.fontSize(12).text(data.content);
        doc.moveDown().moveDown(); // Add two line breaks after each message
    });

    // Finalize the PDF and end the stream
    doc.end();

    // Notify the channel
    writeStream.on('finish', () => {
        channel.send({ files: [fileName] });
    });
}

client.login(token);
