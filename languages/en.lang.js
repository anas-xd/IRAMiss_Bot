module.exports = {
  unknownCommand:
    "Unknown command: '%1'. It seems I couldn't recognize that. Please check the spelling or type /help to view all available commands.",

  helpHint:
    "Need assistance? Use /help to explore all available features and commands. Each command includes a short description and usage example.",

  commandError:
    "An unexpected error occurred while executing this command. This may be due to a temporary issue or invalid input. Please try again later.",

  startMessage: (name, botname, prefix) =>
    `Hello ${name}! 👋\n\nWelcome to *${botname}*, your personal multifunctional Telegram assistant built with Node.js. I'm designed to help you manage tasks, explore information, and have a smooth chat experience.\n\nHere are a few things you can do:\n\n• Type \`${prefix}help\` to view all available commands\n• Stay updated with smart, quick responses\n• Enjoy 24/7 uptime and fast performance ⚡\n\nThank you for choosing *${botname}*. I’m always here to assist you! 😊`,
};