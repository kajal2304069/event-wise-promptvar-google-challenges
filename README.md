# 🎉 EventWise — AI-Powered Event Planner

**Plan smarter. Stay organized. Celebrate more.**

EventWise is an AI-assisted event planning web application designed to make organizing weddings, birthdays, family gatherings, and community events simpler and more manageable. It helps users turn an event idea into an actionable plan with a budget, a dated timeline, a vendor checklist, and personalized suggestions.

With an AI assistant that understands the event plan, users can ask questions, explore ideas, and request updates to tasks, budget items, and vendors in natural language.

## ✨ Key Features

### 📅 Structured Event Planning
- Organize events with a clear planning workflow.
- Build a dated timeline to track important milestones.
- Break a large event into smaller, manageable tasks.

### 💰 Budget Planning
- Organize event expenses into budget line items.
- Plan spending before making purchasing decisions.
- Keep budget-related information alongside the event plan.

### 🤝 Vendor Checklist
- Maintain a checklist of vendors and services needed for an event.
- Organize vendor-related planning details in one place.
- Keep track of the services required to bring the event together.

### 🤖 AI Planning Assistant
- Ask event-related questions using natural language.
- Get personalized ideas and suggestions based on the event plan.
- Request additions to the event's tasks, budget items, and vendor checklist.
- Use conversational assistance to simplify planning decisions.

### 🎯 Designed for Different Occasions
EventWise can support planning for:
- Weddings and receptions
- Birthday parties
- Family celebrations
- Community gatherings
- Other personal and social events

## 💡 The Problem

Planning an event often involves coordinating multiple responsibilities, including budgets, deadlines, vendors, and last-minute decisions. Managing these details across different tools can become confusing and time-consuming.

## 🚀 Our Solution

EventWise brings essential event-planning information together in one application and adds an AI assistant to make the process more interactive.

Instead of manually figuring out every detail from scratch, users can start with their event requirements, organize the plan into actionable items, and use natural-language requests to get relevant suggestions or update their plan.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| HTML5 | Application structure |
| CSS3 | Styling and responsive interface |
| JavaScript | Client-side interactions and application logic |
| Node.js | Server-side runtime |
| Node.js HTTP module | HTTP server and API endpoints |
| Anthropic API | AI-powered conversational assistance |
| Claude model | Natural-language understanding and planning support |

**Architecture:** EventWise uses a lightweight Node.js server to serve the frontend and handle AI chat requests. The server communicates with the Anthropic Messages API, while the frontend provides the event-planning interface.

## 🏗️ Project Structure

```text
event-wise-promptvar-google-challenges/
│
├── public/
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── ai.js
│   │   ├── app.js
│   │   └── data.js
│   ├── favicon.svg
│   └── index.html
│
├── .gitignore
├── package.json
├── server.js
└── README.md
```

- **`public/index.html`** — Main application page.
- **`public/css/styles.css`** — Application styling.
- **`public/js/app.js`** — Frontend application interactions.
- **`public/js/ai.js`** — AI-related frontend functionality.
- **`public/js/data.js`** — Client-side data and supporting logic.
- **`server.js`** — Node.js HTTP server, static file handling, health endpoint, and AI chat API.
- **`package.json`** — Project metadata and run scripts.

## ⚙️ Getting Started

Follow these steps to run EventWise locally.

### Prerequisites

- [Node.js](https://nodejs.org/) version 18 or higher
- npm, which is included with Node.js
- An Anthropic API key to enable the AI assistant

### 1. Clone the repository

```bash
git clone https://github.com/kajal2304069/event-wise-promptvar-google-challenges.git
```

### 2. Navigate to the project directory

```bash
cd event-wise-promptvar-google-challenges
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_MODEL=claude-sonnet-5-5
PORT=3000
```

Replace `your_anthropic_api_key` with your own API key. The model can be changed to a model available to your Anthropic account.

The server also supports an optional `ANTHROPIC_BASE_URL` setting when using a compatible API endpoint.

**Security note:** Never commit your `.env` file or expose your API key in frontend JavaScript or public repositories.

### 4. Start the application

Install Node.js if you haven't already, then run:

```bash
npm start
```

For development with Node.js watch mode:

```bash
npm run dev
```

### 5. Open the application

Visit:

```text
http://localhost:3000
```

The application should now be available in your browser. AI functionality requires a valid API key and a working connection to the configured AI service.

### Health Check

The server exposes a health endpoint:

```text
http://localhost:3000/api/health
```

It reports whether the server is running and whether an AI API key is configured.

## 🧠 How the AI Assistant Works

1. **User input:** The user asks a question or requests help with an event.
2. **Frontend request:** The client sends the conversation to the Node.js backend.
3. **Backend validation:** The server checks the request and applies basic rate limiting.
4. **AI processing:** The backend forwards the conversation to the Anthropic Messages API.
5. **Response handling:** The server returns the AI response to the client.
6. **Planning assistance:** The assistant helps users reason about their event and, where supported by the application, request updates to planning items.

The backend keeps the API key on the server rather than requiring it to be exposed in browser code.

## 🔐 Basic Server Protections

The current server implementation includes:
- Server-side storage of the AI API key through environment configuration.
- A request body size limit.
- Basic per-IP rate limiting for AI requests.
- Error handling for invalid requests and upstream AI API failures.
- Static-file path validation when serving frontend assets.

These are useful baseline protections; additional production security and operational controls may be required for a larger deployment.

## 🎯 Project Goals

EventWise aims to make event planning more approachable by combining structured organization with conversational AI. The goal is to reduce the effort involved in coordinating details and help users move from an initial idea to a more organized plan.

## 🔮 Future Improvements

Potential enhancements include:
- Interactive budget tracking with planned-versus-actual spending.
- Calendar integration and deadline reminders.
- Vendor discovery and comparison.
- Collaborative planning for multiple organizers.
- Exportable event plans and printable checklists.
- Improved persistence and synchronization of event data.
- Additional testing, accessibility improvements, and deployment monitoring.

## 👩‍💻 Author

**Kajal Singh**

- GitHub: [@kajal2304069](https://github.com/kajal2304069)
- Project Repository: [EventWise — AI-Powered Event Planner](https://github.com/kajal2304069/event-wise-promptvar-google-challenges)

## 📄 License

This project declares the MIT license in its package metadata. See the repository's license file, if present, for the applicable terms.

---

*Built to make event planning more organized, interactive, and intelligent.* 🎊
