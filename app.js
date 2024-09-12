import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';


dotenv.config();

// Replace 'YOUR_TELEGRAM_BOT_TOKEN' with your actual Telegram bot token
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const API_BASE_URL = process.env.API_BASE_URL;

// Command to start the bot
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Samixx Yasuke Welcomes You! You can search for anime using /search <animeName>.');
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text || 'No text content';
    const username = msg.from.username || `${msg.from.first_name} ${msg.from.last_name}` || 'Unknown User';

    // Log message to a file
    console.log(`User ID: ${userId}, User Name: ${username} Chat ID: ${chatId}, Message: ${text}\n`);
    logMessageToFile(userId, username, chatId, text);

    // Welcome message or guide
    const welcomeMessage = `Welcome to the Anime Search Bot! You can search for anime using the following commands:\n\n` +
        `/search <animeName> - Search for anime\n` +
        `/details <animeId> - Get details of a specific anime\n` +
        `/recent - Get recent anime that just got released\n` +
        `Use /start to see this message again.`;

    // Check if the user sends a `/start` command or any message for the first time
    if (msg.text === '/start') {
        bot.sendMessage(chatId, welcomeMessage);
    }
    if (!msg.text.startsWith('/')) {
        bot.sendMessage(chatId, welcomeMessage);
    }
});

// Command to search for anime
bot.onText(/\/search (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const animeName = match[1];

    try {
        const response = await axios.get(`${API_BASE_URL}/api/v1/anime/search/${animeName}`);
        const results = response.data.searchResults.results;

        if (results.length === 0) {
            bot.sendMessage(chatId, 'No anime found.');
            return;
        }

        let message = 'Search results:\n';
        results.forEach((anime) => {
            // Highlight the Anime ID in a code block using backticks
            message += `\nAnime ID: \`${anime.id}\`\nRelease Date: ${anime.releaseDate}\nType: ${anime.subOrDub}\n`;
            // Optional: add image
            bot.sendPhoto(chatId, anime.image, { caption: message });
            message = ''; // Clear message after sending photo
        });

        // After sending the results, send a follow-up message
        bot.sendMessage(chatId, 'To get episode information, type /details <enter the anime ID in the correct case>.');

    } catch (error) {
        bot.sendMessage(chatId, `An error occurred while searching for anime ${animeName}, it might not exist in our collection of anime.`);
        console.error(error);
    }
});


// Command to get anime details
bot.onText(/\/details (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const animeId = match[1];

    try {
        const response = await axios.get(`${API_BASE_URL}/api/v1/anime/anime-details/${animeId}`);
        const anime = response.data.animeInfo;

        await bot.sendPhoto(chatId, anime.image);

        let message = `\nTitle: ${anime.title}\nRelease Date: ${anime.releaseDate}\nStatus: ${anime.status}\nType: ${anime.type}\nDescription: ${anime.description}\n`;

        // Add episodes list
        if (anime.episodes.length > 0) {
            message += '\nEpisodes:\n';
            anime.episodes.forEach((episode) => {
                message += `[Episode ${episode.number}](${episode.url})\n`;
            });
        }

        // Split the message if it's too long
        const messageChunks = splitMessage(message);

        // Send each chunk of the message separately
        for (const chunk of messageChunks) {
            await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' });
        }

    } catch (error) {
        bot.sendMessage(chatId, `An error occurred while fetching anime details for ${animeId}, it might not exist in our collection of anime or you got the id wrong`);
        console.error(error);
    }
});

// Command to get episode links
bot.onText(/\/episode (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const animeEpisodeId = match[1];

    try {
        const response = await axios.get(`${API_BASE_URL}/episodes/${animeEpisodeId}`);
        const links = response.data.links.sources;

        if (links.length === 0) {
            bot.sendMessage(chatId, 'No streaming links found.');
            return;
        }

        let message = 'Available streams:\n';
        links.forEach((link) => {
            message += `Quality: ${link.quality}\nURL: ${link.url}\n\n`;
        });

        bot.sendMessage(chatId, message);

    } catch (error) {
        bot.sendMessage(chatId, 'An error occurred while fetching episode links.');
        console.error(error);
    }
});

// Command to get recent anime episodes
bot.onText(/\/recent/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const response = await axios.get(`${API_BASE_URL}/api/v1/anime/recent`);
        const results = response.data.recent.results;

        if (results.length === 0) {
            bot.sendMessage(chatId, 'No recent anime episodes found.');
            return;
        }

        let message = 'Recent episodes:\n';
        results.forEach((episode) => {
            message += `\nTitle: ${episode.title}\nEpisode Number: ${episode.episodeNumber}\n[Watch Episode](${episode.url})\n`;

            // Optional: add image
            bot.sendPhoto(chatId, episode.image, { caption: message });
            message = ''; // Clear message after sending photo
        });

    } catch (error) {
        bot.sendMessage(chatId, 'An error occurred while fetching recent episodes.');
        console.error(error);
    }
});

// Function to split long messages into smaller chunks
function splitMessage(message, chunkSize = 4000) {
    const messageChunks = [];
    for (let i = 0; i < message.length; i += chunkSize) {
        messageChunks.push(message.slice(i, i + chunkSize));
    }
    return messageChunks;
}

// Function to log messages to a file
function logMessageToFile(userId, username, chatId, message) {
    const logEntry = `User ID: ${userId}, Username: ${username}, Chat ID: ${chatId}, Message: ${message}\n`;
    
    // Append the log entry to the file
    fs.appendFile('user_messages.txt', logEntry, (err) => {
        if (err) {
            console.error('Error logging message to file', err);
        }
    });
}
