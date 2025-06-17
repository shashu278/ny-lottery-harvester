const axios = require('axios');
const cheerio = require('cheerio');

// Helper function to get the current date in 'Month Day, Year' format for New York (America/New_York timezone)
function getTodaysDateFormatted() {
  const today = new Date();
  const options = {
    timeZone: 'America/New_York',
    weekday: 'short', // e.g., 'Tue'
    month: 'short',   // e.g., 'Jun'
    day: '2-digit',   // e.g., '17'
    year: 'numeric' // e.g., '2025'
  };
  // Formats to "Tue, Jun 17, 2025"
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(today);
  const dateMap = {};
  parts.forEach(({ type, value }) => {
    dateMap[type] = value;
  });
  // Returns "Jun 17, 2025"
  return `${dateMap.month} ${dateMap.day}, ${dateMap.year}`;
}


// The main function that Netlify will run
exports.handler = async function(event, context) {
  // A list of all the game pages we need to visit
  const gamesToScrape = [
    { name: 'NUMBERS', url: 'https://nylottery.ny.gov/draw-game?game=numbers' },
    { name: 'Win 4', url: 'https://nylottery.ny.gov/draw-game?game=win4' },
    { name: 'Take 5', url: 'https://nylottery.ny.gov/draw-game?game=take5' },
    { name: 'Powerball', url: 'https://nylottery.ny.gov/draw-game?game=powerball' },
    { name: 'Mega Millions', url: 'https://nylottery.ny.gov/draw-game?game=mega-millions' },
    { name: 'Cash4Life', url: 'https://nylottery.ny.gov/draw-game?game=cash4life' },
    { name: 'NY Lotto', url: 'https://nylottery.ny.gov/draw-game?game=lotto' },
    { name: 'Pick 10', url: 'https://nylottery.ny.gov/draw-game?game=pick10' },
  ];

  const liveResults = {};
  const todaysDate = getTodaysDateFormatted();
  console.log(`Starting scraper for date: ${todaysDate}`);

  // Use Promise.all to fetch all pages concurrently for speed
  await Promise.all(
    gamesToScrape.map(async (game) => {
      try {
        const { data } = await axios.get(game.url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36' }
        });
        const $ = cheerio.load(data);

        // Find the most recent draw result container on the page
        const latestDraw = $('div[class*="DrawGame-module--desktop-container"]').first();

        const drawDateText = latestDraw.find('div[class*="DrawGame-module--date-"]').text().trim(); // e.g., "Mon, Jun 16, 2025"
        
        // Clean the scraped date to match our format
        const cleanedDrawDate = drawDateText.split(', ').slice(1).join(', '); // "Jun 16, 2025"
        
        console.log(`Checking ${game.name}: Scraped date is "${cleanedDrawDate}"`);

        // IMPORTANT: Compare the scraped date with today's date
        if (cleanedDrawDate === todaysDate) {
          const drawTime = latestDraw.find('div[class*="DrawGame-module--label"]').text().trim(); // 'Midday' or 'Evening'
          const numbers = latestDraw.find('div[class*="DrawGame-module--numbers"]').text().trim();

          if (!liveResults[game.name]) {
            liveResults[game.name] = {};
          }
          liveResults[game.name][drawTime] = numbers;
          console.log(`SUCCESS: Match found for ${game.name} - ${drawTime}: ${numbers}`);
        }

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
