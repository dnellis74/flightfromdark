# Flight from Dark

An interactive gamebook interpreter for Lone Wolf gamebooks, built with Next.js and OpenAI. This application parses gamebook sections, extracts game actions, and manages player state including combat, inventory, and character statistics.

## Features

- **AI-Powered Section Interpretation**: Uses OpenAI to parse gamebook sections and extract game actions (stat updates, inventory changes, combat, flags, etc.)
- **Combat System**: Full implementation of the Lone Wolf combat system with:
  - Combat Results Table (CRT) resolution
  - Sequential multi-enemy combat
  - Combat modifiers and evasion
  - Detailed combat logging
- **Inventory Management**: 
  - Weapon slots (2 max)
  - Backpack (8 items max)
  - Special items with location slots (head, neck, finger, hands, feet, etc.)
  - Gold pouch
  - Item dropping and pickup mechanics
- **Action Sheet Tracking**:
  - Endurance Points (EP)
  - Combat Skill (CS)
  - Flags and game state
  - Removed choices tracking
- **Section Navigation**: Interactive section viewer with choice-based navigation

## Tech Stack

- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **OpenAI API** - Section interpretation and action extraction
- **Zod** - Schema validation

## Getting Started

### Prerequisites

- Node.js 20 or later
- npm, yarn, pnpm, or bun
- OpenAI API key (set as environment variable)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd flightfromdark
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

4. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
app/
  ├── api/
  │   ├── interpret/        # OpenAI API endpoint for section interpretation
  │   └── sect/[id]/        # Section data API endpoint
  ├── components/
  │   └── SectionViewer.tsx # Main game interface component
  ├── lib/
  │   ├── gameLogic.ts      # Core game mechanics (combat, inventory, actions)
  │   └── crt.ts            # Combat Results Table
  └── page.tsx              # Main page entry point
```

## Game Mechanics

### Combat System

The combat system implements the Lone Wolf combat rules:
- Combat Ratio = (Lone Wolf CS + modifiers) - (Enemy CS + modifiers)
- Random Number Table (0-9) determines damage
- CRT lookup resolves damage for both combatants
- Combat continues until one combatant's endurance reaches 0
- Supports sequential multi-enemy combat

### Inventory System

Items are automatically categorized:
- **Weapons**: Swords, axes, daggers, bows, etc. (max 2)
- **Special Items**: Helmets, amulets, rings, shields, etc. (location-based)
- **Backpack**: General items (max 8)
- **Gold**: Stored in pouch

### Action Types

The system supports various action types:
- `update_stat` - Modify endurance, combat skill, or gold
- `set_stat` - Set a stat to a specific value
- `add_item` - Add item to inventory
- `remove_item` - Remove item from inventory
- `drop_item` - Drop item at a section (for pickup)
- `set_flag` - Set game state flags
- `start_combat` - Initiate combat with enemies
- `remove_choice` - Hide specific choices based on game state

## Development

### Building for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Roadmap

Planned improvements and features:

- **Character Creation UI**: Build an interface for creating and customizing Lone Wolf characters, including initial stat allocation, discipline selection, and starting equipment.

- **Game Text Caching**: Implement caching for game text pulled directly from Project Aon to reduce API calls and improve performance. This will store section content locally for faster access.

- **OpenAI Interpretation Caching**: Add intelligent caching for OpenAI interpretations of gamebook sections. Since the current game state often doesn't impact section outcomes, cached interpretations can be reused across playthroughs, significantly reducing API costs and improving response times.

## License

[Add your license here]
