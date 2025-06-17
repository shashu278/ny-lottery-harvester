const axios = require('axios');
const cheerio = require('cheerio');

// Helper function to get the current date in the format 'Weekday, Month Day, Year'
// e.g., "Tuesday, June 17, 2025" to match the lottery website's format.
function getTodaysDateFormatted() {
  const today = new Date();
  return today.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

// The main function that Netlify will run
exports.handler = async function(event, context) {
  const gamesToScrape = [
    { name: 'NUMBERS', url: 'https://nylottery.ny.gov/draw-game?game=numbers' },
    { name: 'Win 4', url: 'https://nylottery.ny.gov/draw-game?game=win4' },
    { name: 'Take 5', url: 'https://nylottery.ny.gov/draw-game?game=take5' },
  ];

  const liveResults = {};
  const todaysDate = getTodaysDateFormatted();
  console.log(`Starting scraper for date: ${todaysDate}`);

  // Use Promise.all to fetch all pages concurrently for speed
  await Promise.all(
    gamesToScrape.map(async (game) => {
      try {
        const { data } = await axios.get(game.url);
        const $ = cheerio.load(data);

        // Find all draw result containers on the page
        $('div[class*="DrawGame-module--desktop-container"]').each((index, element) => {
          const container = $(element);
          
          // The date is now inside an h4 tag
          const drawDateText = container.find('h4').text().trim();
          
          console.log(`Checking ${game.name}: Scraped date is "${drawDateText}"`);

          // Compare the scraped date with today's date
          if (drawDateText.includes(todaysDate)) {
            const drawTime = container.find('div[class*="DrawGame-module--label"]').text().trim();
            
            // The numbers are in individual spans inside the numbers container
            const numbers = container.find('div[class*="DrawGame-module--numbers"] span')
                                     .map((i, el) => $(el).text())
                                     .get()
                                     .join(''); // Join them into a single string

            if (drawTime && numbers) {
              if (!liveResults[game.name]) {
                liveResults[game.name] = {};
              }
              liveResults[game.name][drawTime] = numbers;
              console.log(`SUCCESS: Match found for ${game.name} - ${drawTime}: ${numbers}`);
            }
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
