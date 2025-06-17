const axios = require('axios');
const cheerio = require('cheerio');

// Helper function to get the current date in the MM/DD/YY format for New York
function getTodaysDateFormatted() {
  const today = new Date();
  const options = {
    timeZone: 'America/New_York',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  };
  // This will correctly format the date as "06/17/25"
  return new Intl.DateTimeFormat('en-US', options).format(today);
}

// The main function that Netlify will run
exports.handler = async function(event, context) {
  const gamesToScrape = [
    { name: 'Numbers', url: 'https://nylottery.ny.gov/draw-game?game=numbers' },
    { name: 'Win 4', url: 'https://nylottery.ny.gov/draw-game?game=win4' },
    { name: 'Take 5', url: 'https://nylottery.ny.gov/draw-game?game=take5' },
    { name: 'NY Lotto', url: 'https://nylottery.ny.gov/draw-game?game=lotto' },
    { name: 'Cash4Life', url: 'https://nylottery.ny.gov/draw-game?game=cash4life' },
    { name: 'Powerball', url: 'https://nylottery.ny.gov/draw-game?game=powerball' },
    { name: 'Mega Millions', url: 'https://nylottery.ny.gov/draw-game?game=mega-millions' },
    { name: 'Pick 10', url: 'https://nylottery.ny.gov/draw-game?game=pick10' },
  ];

  const liveResults = {};
  const todaysDate = getTodaysDateFormatted(); // e.g., "06/17/25"
  console.log(`Starting scraper. Searching for date: ${todaysDate}`);

  // Use Promise.all to fetch all pages concurrently for speed
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

          // *** THE CRITICAL FIX: Check if the raw text from the website INCLUDES today's formatted date ***
          if (drawDateText.includes(todaysDate)) {
            const drawTime = container.find('div[class*="DrawGame-module--label"]').text().trim() || 'Evening'; // Default to Evening if no label
            
            // The numbers are in individual spans, we must join them
            const numbers = container.find('div[class*="DrawGame-module--numbers"] span')
                                     .map((i, el) => $(el).text())
                                     .get()
                                     .join(' '); // Join with spaces for readability

            if (numbers) {
              if (!liveResults[game.name]) {
                liveResults[game.name] = {};
              }
              // Prevent overwriting if Midday and Evening results are on the same page for the same day
              liveResults[game.name][drawTime] = numbers;
              console.log(`SUCCESS: Date match for ${game.name} - ${drawTime}: ${numbers}`);
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
