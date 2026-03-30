# Farkle Lab

Farkle Lab is a static browser-based Farkle app that lets you play a full game while also exploring the math behind each turn. It combines a playable human-vs-CPU match with strategy tools that explain when rolling again is worth the risk and when banking is the stronger call.

## What the app does

- Runs a full 6-dice Farkle game in the browser with a human player and a CPU opponent.
- Shows the legal scoring choices for each roll and highlights the strongest scoring keep available.
- Precomputes exact expected-value tables for 1 through 6 dice so the app can compare rolling versus banking.
- Includes a Game State Advisor where you can plug in custom scores, turn totals, and dice counts to get a recommendation.
- Surfaces late-game pressure guidance so you can see when chasing a bigger turn is worth it.

## Technologies used

- Vanilla JavaScript for the game loop, scoring logic, CPU decisions, and exact EV table generation.
- HTML5 for the interface structure and semantic page layout.
- CSS3 for the responsive layout, styling, and game presentation.
- Google Fonts for typography.
- Static-site friendly assets and structure suitable for GitHub Pages deployment.
