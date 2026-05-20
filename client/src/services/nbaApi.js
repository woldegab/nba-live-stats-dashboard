const API_KEY = "74e465e9-ce27-4944-9725-b9d4059a0ace";

export async function getGames() {
    const today = new Date().toISOString().split("T")[0];
  
    const response = await fetch(
      `https://api.balldontlie.io/v1/games?dates[]=${today}`,
      {
        headers: {
          Authorization: API_KEY,
        },
      }
    );
  
    const data = await response.json();
  
    return data.data;
  }