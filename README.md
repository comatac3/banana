# Banana - AI-Powered Avatar + Product Image Composer

A SaaS application that uses Google's Gemini 2.5 Flash Image model to intelligently compose images of avatars holding products. Upload a person/avatar photo and a product photo, and let AI determine the best way to make them appear together naturally.

## Features

- Upload avatar and product images
- AI-powered image analysis using Gemini 2.5 Flash
- Intelligent composition with automatic positioning, scaling, and rotation
- Canvas-based image rendering
- Download composed images as PNG
- Modern, responsive UI built with Next.js and Tailwind CSS

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI**: Google Gemini 2.5 Flash Image API
- **Image Processing**: HTML5 Canvas API

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Google AI API key (get one from [Google AI Studio](https://aistudio.google.com/apikey))

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd banana
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Add your Gemini API key:
```
GEMINI_API_KEY=your_api_key_here
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## How It Works

1. **Upload Images**: Select an avatar image (person) and a product image
2. **AI Analysis**: Gemini 2.5 Flash analyzes both images to understand:
   - Avatar pose and hand position
   - Product characteristics
   - Optimal composition parameters
3. **Composition**: The app uses HTML Canvas to composite the images based on AI suggestions
4. **Download**: Save the final composed image

## API Routes

### POST /api/compose

Accepts two base64-encoded images and returns composition data.

**Request Body:**
```json
{
  "avatarImage": "base64_encoded_image",
  "productImage": "base64_encoded_image"
}
```

**Response:**
```json
{
  "composedImage": "{\"avatar\":\"...\",\"product\":\"...\",\"composition\":{...}}"
}
```

## Project Structure

```
banana/
├── app/
│   ├── api/
│   │   └── compose/
│   │       └── route.ts      # Gemini API integration
│   ├── page.tsx              # Main page
│   └── layout.tsx            # Root layout
├── components/
│   ├── ImageUploader.tsx     # Image upload component
│   └── ImageComposer.tsx     # Canvas composition component
├── .env.local                # Environment variables
└── package.json
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google AI API key for Gemini | Yes |

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Future Enhancements

- User authentication and account management
- Usage limits and subscription tiers
- API access for developers
- Batch processing
- Advanced editing tools (manual adjustments)
- Image history and gallery
- Social media sharing

## License

MIT

## Credits

Built with Next.js and powered by Google Gemini 2.5 Flash Image API.
