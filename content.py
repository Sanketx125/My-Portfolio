"""
content.py — single source of truth for the portfolio site.

Everything rendered on the page (and everything the chatbot is allowed to
talk about) comes from this file. Nothing person-specific is hardcoded in
the templates. Edit this file to update the site.
"""

CONTENT = {
    "name": "Sanket Uday Mane",
    "title": "AI Engineer · Geospatial AI Developer · Software Engineer",
    "tagline": (
        "I build systems that make sense of the physical world — from LiDAR "
        "point clouds and satellite imagery to production LLM applications."
    ),
    "location": "Bangalore, Karnataka, India",
    "availability": "Open to AI/ML, Geospatial AI & LLM engineering roles",
    "email": "Sanketx125@gmail.com",
    "socials": {
        "github": "https://github.com/Sanketx125",
        "linkedin": "https://www.linkedin.com/in/sanket-mane-784a01216/",
        "twitter_x": "",
    },
    "photo": "images/profile.jpg",
    # Replace with a 1200x630 social-preview image when you have one.
    "og_image": "images/profile.jpg",

    "about": (
        "I'm an AI/ML engineer working at the intersection of geospatial data "
        "and generative AI. Day to day that means training detection and "
        "segmentation models on satellite and drone imagery, classifying "
        "LiDAR point clouds, and building the RAG and agentic-AI systems that "
        "sit on top of that data. I've implemented transformer architectures "
        "from scratch in PyTorch, fine-tuned open-source LLMs for production "
        "use, and lean hard on AI-assisted debugging and automation to move "
        "fast on unfamiliar problems. Outside of shipped work, I mentor "
        "junior engineers and students on problem solving, ML, and deep "
        "learning fundamentals."
    ),

    "stats": [
        {"number": "3+", "label": "years professional experience"},
        {"number": "6+", "label": "AI models in one production pipeline"},
        {"number": "95%+", "label": "classification accuracy delivered"},
    ],

    "skills": {
        "ai_ml": [
            "PyTorch",
            "Transformer / GPT architecture from scratch",
            "LLM fine-tuning",
            "RAG & Agentic AI (LangChain)",
            "Computer Vision (YOLOv8 / YOLOv12)",
            "Prompt Engineering",
            "Custom Chatbots",
            "scikit-learn",
        ],
        "geospatial": [
            "LiDAR point cloud classification (.las / .laz)",
            "PointNet++",
            "Satellite & drone imagery analysis",
            "Cloth Simulation Filter height metrics",
            "GeoAI data pipelines",
            "Remote sensing workflows",
        ],
        "software": [
            "Python",
            "C++",
            "SQL / MySQL",
            "Flask",
            "Git / GitHub",
            "Data preprocessing & annotation",
            "AI-assisted debugging",
        ],
    },

    "experience": [
        {
            "company": "NakshaTech Pvt Ltd",
            "role": "AI/ML Engineer",
            "location": "Bangalore, Karnataka",
            "dates": "Oct 2025 – Present",
            "current": True,
            "bullets": [
                "Develop and train deep learning models for detection and segmentation on satellite/drone imagery and LiDAR data, handling large-scale data preprocessing and annotation for GeoAI workflows.",
                "Fine-tuned open-source LLMs for backend automation and a custom internal chatbot, and built RAG-based agentic AI workflows using LangChain and prompt engineering.",
                "Accelerate development speed and issue resolution using AI-assisted debugging, AI data analytics, custom GPTs, and AI automation; run structured R&D before new initiatives to deliver reliably on unfamiliar tasks.",
                "Recognized with the company's Code Catalyst Award on NakshaTech's 14th Anniversary Day for contributions and performance as an AI/ML Engineer.",
            ],
        },
        {
            "company": "PHN Technology Pvt Ltd",
            "role": "Machine Learning Engineer Intern",
            "location": "Pune, Maharashtra",
            "dates": "Oct 2023 – Mar 2024",
            "current": False,
            "bullets": [
                "Assisted in developing and training machine learning models using supervised, unsupervised, and semi-supervised learning techniques.",
                "Improved experimentation and troubleshooting workflows through practical use of AI tools for analysis, validation, and faster iteration.",
            ],
        },
        {
            "company": "Q-connect Business Solution",
            "role": "Technical Support Executive (System Engineer)",
            "location": "Pune, Maharashtra",
            "dates": "Dec 2022 – Jun 2023",
            "current": False,
            "bullets": [
                "Provided systems and technical support, building the troubleshooting and root-cause habits that carried into later ML debugging work.",
            ],
        },
    ],

    "projects": [
        {
            "title": "NakshAI_LiDAR Software",
            "category": "geospatial",
            "featured": True,
            "location": "Bangalore, India",
            "coords": [12.9716, 77.5946],
            "description": (
                "Geospatial classification software for geological entities, "
                "built as an in-house alternative to Bentley MicroStation."
            ),
            "detail": (
                "Integrated 6+ AI models into a single classification pipeline "
                "for geological entity detection from survey data, reaching "
                "95%+ accuracy while cutting manual classification effort."
            ),
            "stack": ["Python", "PyTorch", "GeoAI", "Point Cloud Processing"],
            "image": "",
            "github": "",
            "live_url": "",
        },
        {
            "title": "PointNet++ for LiDAR Classification",
            "category": "geospatial",
            "featured": True,
            "location": "Bangalore, India",
            "coords": [12.9716, 77.5946],
            "description": (
                "End-to-end pipeline for semantic classification of 3D LiDAR "
                "point clouds (.las / .laz)."
            ),
            "detail": (
                "Custom PointNet++ architecture with advanced feature "
                "extraction using Cloth Simulation Filter-based height "
                "metrics, built for real-world geological survey data."
            ),
            "stack": ["PyTorch", "PointNet++", "LiDAR", "CSF"],
            "image": "",
            "github": "",
            "live_url": "",
        },
        {
            "title": "Drone & Dashcam Road Survey Detection",
            "category": "geospatial",
            "featured": True,
            "location": "NH4 corridor, Karnataka",
            "coords": [13.3379, 77.1010],
            "description": (
                "Object detection for NH4 road survey footage from drone and "
                "dashcam sources."
            ),
            "detail": (
                "YOLOv8/YOLOv12-based detection covering vehicles, road "
                "damage, buffer-zone violations, cracks, and road-line "
                "condition, built for large-scale highway survey analysis."
            ),
            "stack": ["YOLOv8", "YOLOv12", "Computer Vision", "Python"],
            "image": "",
            "github": "",
            "live_url": "",
        },
        {
            "title": "Bangalore Traffic Density Dashboard",
            "category": "ai",
            "featured": True,
            "location": "Bangalore, India",
            "coords": [12.9716, 77.5946],
            "description": (
                "Class-wise vehicle detection dashboard for time-based "
                "traffic density estimation."
            ),
            "detail": (
                "Model trained on 10k Indian vehicle samples reaching 96%+ "
                "accuracy, feeding a dashboard for time-based density "
                "estimation across the city."
            ),
            "stack": ["YOLO", "Computer Vision", "Dashboarding"],
            "image": "",
            "github": "",
            "live_url": "",
        },
    ],

    "education": [
        {
            "school": "Savitribai Phule Pune University (SPPU)",
            "degree": "B.E. in Information Technology",
            "dates": "Sept 2021 – Mar 2024",
            "detail": "CGPA: 7.46/10",
        },
    ],

    # Live GitHub data is fetched server-side via the GraphQL API when
    # GITHUB_TOKEN is set (see services/github.py). `fallback_repos` is only
    # used when no token is configured — leave it empty to show a tasteful
    # "connect a token" state instead of inventing repositories.
    "github": {
        "username": "Sanketx125",
        "fallback_repos": [],
    },

    "resume": {
        "summary": (
            "AI/ML engineer building production systems where geospatial data, "
            "computer vision, and LLMs meet — from LiDAR point clouds and "
            "satellite imagery to RAG and agentic AI."
        ),
        "highlights": [
            "3+ years building production AI/ML and geospatial systems",
            "Shipped a 6-model LiDAR classification pipeline at 95%+ accuracy",
            "Fine-tuned open source LLMs and shipped RAG / agentic workflows in LangChain",
            "Trained a 10k-sample vehicle detector at 96%+ accuracy for city-scale traffic analysis",
            "Recipient of NakshaTech's Code Catalyst Award",
        ],
    },

    "resume_pdf": "files/resume.pdf",
}
