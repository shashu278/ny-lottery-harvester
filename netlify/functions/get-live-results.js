const axios = require('axios');
const cheerio = require('cheerio');

// Helper function to get the current date in MM/DD/YY format for New York
function getTodaysDateFormatted() {
  const today = new Date();
  // Options to get the date in the America/New_York timezone
  const options = {
    timeZone: 'America/New_York',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  };
  // This will format the date as "06/17/25"
  return new Intl.DateTimeFormat('en-US', options).format(today);
}

// The main function that Netlify will run
exports.handler = async function(event, context) {
  const gamesToScrape = [
    { name: 'NUMBERS', url: 'https://nylottery.ny.gov/draw-game?game=numbers' },
    { name: 'Win 4', url: 'https://nylottery.ny.gov/draw-game?game=win4' },
    { name: 'Take 5', url: 'https://nylottery.ny.gov/draw-game?game=take5' },
    // Add other game pages here if needed
  ];

  const liveResults = {};
  const todaysDate = getTodaysDateFormatted(); // e.g., "06/17/25"
  console.log(`Starting scraper for date string: ${todaysDate}`);

  await Promise.all(
    gamesToScrape.map(async (game) => {
      try {
        const { data } = await axios.get(game.url);
        const $ = cheerio.load(data);

        // Find all the draw result containers on the page
        $('div[class*="DrawGame-module--desktop-container"]').each((index, element) => {
          const container = $(element);
          
          // The full date text is inside an h4 tag, e.g., "Midday Tue 06/17/25"
          const drawDateText = container.find('h4').text().trim();
          
          console.log(`Checking ${game.name}: Found raw date text "${drawDateText}"`);

          // *** THE CRITICAL FIX IS HERE ***
          // We check if the raw text from the website INCLUDES today's formatted date
          if (drawDateText.includes(todaysDate)) {
            const drawTime = container.find('div[class*="DrawGame-module--label"]').text().trim();
            
            // The numbers are in individual spans, we must join them
            const numbers = container.find('div[class*="DrawGame-module--numbers"] span')
                                     .map((i, el) => $(el).text())
                                     .get()
                                     .join(''); // Join without spaces for games like Numbers/Win4

            if (drawTime && numbers) {
              if (!liveResults[game.name]) {
                liveResults[game.name] = {};
              }
              liveResults[game.name][drawTime] = numbers;
              console.log(`SUCCESS: Date match for ${game.name} - ${drawTime}: ${numbers}`);
            }
          } else {
             console.log(`NO MATCH: "${drawDateText}" does not contain "${todaysDate}"`);
          }
        });

      } catch (error) {
        console.error(`Error scraping ${game.name}:`, error.message);
      }
    })
  );

  console.log("Scraping complete. Final live results:", JSON.stringify(liveResults, null, 2));

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(liveResults),
  };
};
