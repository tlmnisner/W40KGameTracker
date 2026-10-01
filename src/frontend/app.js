async function loadGames() {
    const response = await fetch("http://127.0.0.1:8000/games/");

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log(data);
}

async function addGame() {
    const response = await fetch("http://127.0.0.1:8000/games/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            title: "Example Game",
            game_description: "Friendly game with the boys.",
            player_one_name: "Bob",
            player_two_name: "Rob"
        })
    });

    const data = await response.json();
    console.log(data);
}

addGame();

loadGames();