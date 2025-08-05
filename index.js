const container = document.getElementById("crypto-container");

const fetchCrypto = async () => {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false"
  );
  const data = await res.json();

  container.innerHTML = "";

  data.forEach((coin) => {
    const changeClass = coin.price_change_percentage_24h >= 0 ? "positive" : "negative";

    const div = document.createElement("div");
    div.classList.add("crypto");
    div.innerHTML = `
      <h2>${coin.name} (${coin.symbol.toUpperCase()})</h2>
      <p> Price: $${coin.current_price.toLocaleString()}</p>
      <p class="${changeClass}">24h Change: ${coin.price_change_percentage_24h.toFixed(2)}%</p>
    `;
    container.appendChild(div);
  });
};

fetchCrypto();
setInterval(fetchCrypto, 30000); 
