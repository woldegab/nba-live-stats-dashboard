const API_KEY = "74e465e9-ce27-4944-9725-b9d4059a0ace";

export async function getGames() {
  const today = new Date().toLocaleDateString("en-CA");

  const response = await fetch(
    `https://api.balldontlie.io/v1/games?dates[]=${today}`,
    {
      headers: {
        Authorization: API_KEY,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Games request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data;
}

export async function searchPlayers(playerName) {
  const response = await fetch(
    `https://api.balldontlie.io/v1/players?search=${playerName}`,
    {
      headers: {
        Authorization: API_KEY,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Player search failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data;
}
export async function getPlayer(playerId) {
    const response = await fetch(
      `https://api.balldontlie.io/v1/players/${playerId}`,
      {
        headers: {
          Authorization: API_KEY,
        },
      }
    );
  
    if (!response.ok) {
      throw new Error(`Player request failed: ${response.status}`);
    }
  
    const data = await response.json();
    return data.data;
  }