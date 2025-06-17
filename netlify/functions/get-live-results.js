const axios = require('axios');
const cheerio = require('cheerio');

// Helper function to get the current date in the format used by the website's source, e.g., "06/17/25"
function getTodaysDateFormatted() {
  const today = new Date();
  const options = { timeZone: 'America/New_York' };
  
  const year = today.toLocaleString('en-US', { ...options, year: '2-digit' });
  const month = today.toLocaleString('en-US', { ...options, month: '2-digit' });
  const day = today.toLocaleString('en-US', { ...options, day: '2-digit' });
  
  return `${month}/${day}/${year}`;
}

// The main function that Netlify will run
exports.handler = async function(event, context) {
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
        const { data } = await axios.get(game.url);
        const $ = cheerio.load(data);

        // This selector is now based on the exact structure you provided
        $('div[class*="DrawGame-module--desktop-container"]').each((index, element) => {
          const container = $(element);
          
          // The date text is inside a div, e.g., "Midday Tue 06/17/25"
          const dateString = container.find('div[class*="DrawGame-module--date-"]').text().trim();
          
          console.log(`Checking ${game.name}: Scraped date string is "${dateString}"`);
          
          // Check if the scraped date string contains today's formatted date
          if (dateString.includes(todaysDate)) {
            const drawTime = container.find('div[class*="DrawGame-module--label"]').text().trim(); // 'Midday' or 'Evening'
            
            // The numbers are in individual span elements
            const numbers = container.find('div[class*="DrawGame-module--numbers"] span')
                                     .map((i, el) => $(el).text())
                                     .get()
                                     .join(' '); // Join with spaces for readability

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
