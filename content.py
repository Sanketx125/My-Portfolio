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
        "junior students and working professionals on problem solving, ML, and deep "
        "learning fundamentals."
    ),

    "stats": [
        {"number": "3+", "label": "years professional experience"},
        {"number": "6+", "label": "AI models in one production pipeline"},
        {"number": "10k+", "label": "Indian vehicle dataset samples trained"},
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
            "company": "Nakshatech Pvt Ltd",
            "role": "AI/ML Engineer",
            "location": "Bangalore, Karnataka",
            "dates": "Oct 2025 – Present",
            "current": True,
            "bullets": [
                "Develop and train deep learning models for detection and segmentation on satellite/drone imagery and LiDAR data, handling large-scale data preprocessing and annotation for GeoAI workflows.",
                "Fine-tuned open-source LLMs for backend automation and a custom internal chatbot, and built RAG-based agentic AI workflows using LangChain and prompt engineering.",
                "Accelerate development speed and issue resolution using AI-assisted debugging, AI data analytics, custom GPTs, and AI automation; run structured R&D before new initiatives to deliver reliably on unfamiliar tasks.",
                "Recognized with the company's Code Catalyst Award on Nakshatech's 14th Anniversary Day for contributions and performance as an AI/ML Engineer.",
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
                "for geological entity detection from survey data to speed up "
                "classification and reduce manual classification effort."
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
                "Model trained on 10k Indian vehicle samples, feeding an "
                "interactive dashboard for class-wise vehicle detection and "
                "time-based traffic density estimation."
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
            "focus": "Data Structures and Algorithms, Databases, Operating Systems, Computer Networks, Machine Learning, Deep Learning, Data Science, Image Processing",
        },
    ],

    "recognition": [
        {
            "id": "code-catalyst",
            "title": "Code Catalyst Award",
            "issuer": "Nakshatech Pvt Ltd",
            "event": "14th Anniversary Day",
            "date": "Oct 2025",
            "badge": "Company Honor",
            "summary": (
                "Recognized on the company’s 14th Anniversary Day at Nakshatech "
                "for contributions and performance as an AI/ML Engineer."
            ),
            "highlights": [
                "Awarded on Nakshatech's 14th Anniversary Day",
                "Recognized for performance and contributions as an AI/ML Engineer",
                "Official spelling evidenced by the award photo in a LinkedIn post",
            ],
        }
    ],

    "social_proof": {
        "linkedin": {
            "url": "https://www.linkedin.com/in/sanket-mane-784a01216/",
            "headline": "AI/ML Engineer · Geospatial AI & Generative AI",
            "profile_handle": "sanket-mane-784a01216",
        },
        "verified_impact": [
            {"metric": "6+", "label": "Pipeline Models", "context": "Integrated AI models for geological entity classification"},
            {"metric": "10k+", "label": "Survey Samples", "context": "Indian traffic dataset annotated & trained for density analysis"},
            {"metric": "Award", "label": "Code Catalyst", "context": "Recognized on Nakshatech 14th Anniversary Day as an AI/ML Engineer"},
            {"metric": "Mentor", "label": "College & Community", "context": "Guiding students & junior devs in ML, deep learning, and problem solving"},
        ],
        "unverified_metrics": {
            "followers": {"value": 1200, "display": "1.2K+", "verified": False, "source": "UNVERIFIED"},
            "impressions": {"value": 10000, "display": "10K+", "verified": False, "source": "UNVERIFIED"},
            "mentees_count": {"value": 40, "display": "40+", "verified": False, "source": "UNVERIFIED"},
        },
    },

    "portfolio_intelligence": {
        "recruiter": {
            "profile_30s": (
                "Sanket Mane is an AI/ML Engineer specializing in Geospatial AI, "
                "Computer Vision, and production LLMs. He built and shipped an "
                "in-house 6-model LiDAR classification system for Nakshatech as an "
                "alternative to Bentley MicroStation, trained custom YOLO detection "
                "models on 10k+ Indian vehicle samples, and builds LangChain RAG & "
                "agentic workflows. Recipient of Nakshatech's Code Catalyst Award on "
                "the company's 14th Anniversary Day."
            ),
            "why_hire_me": [
                {
                    "pillar": "Production Pipeline Delivery",
                    "desc": "Engineers multi-model deep learning pipelines into deployed software, integrating 6+ models to automate classification and eliminate manual workflows."
                },
                {
                    "pillar": "Geospatial AI & 3D Point Clouds",
                    "desc": "Hands-on experience processing 3D LiDAR (.las/.laz), implementing PointNet++ with Cloth Simulation Filter (CSF) height metrics, and handling satellite/drone imagery."
                },
                {
                    "pillar": "Computer Vision & Deep Learning",
                    "desc": "Experienced in YOLOv8/YOLOv12 object detection on highway corridor footage, custom dataset annotation, and building transformers from scratch in PyTorch."
                },
                {
                    "pillar": "AI Automation & Technical Problem Solving",
                    "desc": "Builds LangChain RAG pipelines, fine-tunes open-source LLMs, and uses AI-assisted debugging and structured R&D to deliver on complex engineering requirements."
                }
            ],
            "achievements": [
                {"number": "6+", "label": "Production Models", "detail": "Orchestrated in unified GeoAI classification engine"},
                {"number": "10k+", "label": "Vehicle Samples", "detail": "Annotated and trained for traffic density estimation"},
                {"number": "LiDAR", "label": "PointNet++ & CSF", "detail": "End-to-end 3D point cloud classification pipeline"},
                {"number": "Award", "label": "Code Catalyst", "detail": "Honored on Nakshatech 14th Anniversary Day"},
            ],
            "sample_jds": [
                {
                    "title": "AI/ML Engineer (Computer Vision & LLMs)",
                    "content": "Looking for an AI/ML Engineer proficient in PyTorch, Computer Vision (YOLOv8/v12), and Generative AI (LLMs, LangChain, RAG). Experience handling end-to-end ML pipelines from data annotation to deployment is essential. Strong problem-solving and rapid prototyping required."
                },
                {
                    "title": "Geospatial AI Developer (LiDAR & Remote Sensing)",
                    "content": "Seeking a GeoAI Developer experienced in LiDAR point cloud processing (.las/.laz), 3D deep learning (PointNet++), satellite/drone imagery analysis, and spatial data engineering. Must have delivered high-accuracy classification models on real-world survey datasets."
                },
                {
                    "title": "Generative AI & Agentic Systems Engineer",
                    "content": "Seeking an AI Engineer with proven experience fine-tuning open-source LLMs, building production RAG pipelines, and implementing multi-step agentic workflows with LangChain and vector databases. Prior background in system troubleshooting and backend APIs is preferred."
                }
            ]
        },
        "tech_dive": {
            "architectures": [
                {
                    "id": "lidar-pipeline",
                    "title": "NakshAI Multi-Model LiDAR Pipeline",
                    "summary": "End-to-end semantic classification pipeline for geological point cloud entities (.las/.laz).",
                    "steps": [
                        {"step": "01. Ingestion", "desc": "Raw LiDAR (.las/.laz) parsing with parallel chunking and spatial indexing."},
                        {"step": "02. Ground Filtering", "desc": "Cloth Simulation Filter (CSF) establishes bare-earth terrain baseline and normalizes point elevation."},
                        {"step": "03. 3D Feature Extraction", "desc": "PointNet++ hierarchical learning captures local geometric neighborhoods and spatial context."},
                        {"step": "04. Multi-Model Integration", "desc": "6+ specialized models integrated into unified software replacing Bentley MicroStation manual steps."}
                    ]
                },
                {
                    "id": "rag-agents",
                    "title": "Agentic RAG & Fine-Tuned LLM Stack",
                    "summary": "Context-aware query answering and workflow automation over domain documentation.",
                    "steps": [
                        {"step": "01. Document Chunking", "desc": "Text splitting with semantic boundary preservation and metadata tagging."},
                        {"step": "02. Dense Retrieval", "desc": "High-dimensional vector embeddings with retrieval for relevant context injection."},
                        {"step": "03. Open-Source LLMs", "desc": "Fine-tuned models for internal automation and customized question answering."},
                        {"step": "04. Agentic Workflows", "desc": "LangChain multi-step orchestration with prompt engineering and tool execution."}
                    ]
                }
            ],
            "engineering_decisions": [
                {
                    "title": "Cloth Simulation Filter (CSF) for Point Cloud Height Metrics",
                    "choice": "Physical Cloth Simulation Filter (CSF)",
                    "context": "3D LiDAR point cloud classification requires distinguishing ground terrain from elevated geological formations and surface entities.",
                    "rationale": "CSF models an inverted cloth draping over inverted LiDAR points to extract true bare-earth topography, providing normalized height-above-ground metrics for classification.",
                    "source": "PointNet++ Architecture for LiDAR Data Classification (Resume Project)"
                },
                {
                    "title": "PointNet++ Direct Point Processing for 3D LiDAR",
                    "choice": "Hierarchical PointNet++ on Raw 3D Points",
                    "context": "Semantic classification of large-scale .las/.laz files requires learning features from irregular, unorganized 3D point distributions.",
                    "rationale": "PointNet++ directly consumes unordered point sets with hierarchical metric space grouping, learning local geometric structures without losing point fidelity.",
                    "source": "PointNet++ Architecture for LiDAR Data Classification (Resume Project)"
                },
                {
                    "title": "YOLOv8 & YOLOv12 for Highway Survey Detection",
                    "choice": "Single-Stage YOLOv8 / YOLOv12 Architectures",
                    "context": "Highway survey feeds from drone and dashcam footage along the NH4 corridor require high-throughput multi-class object detection.",
                    "rationale": "YOLO single-stage architectures provide fast inference on video feeds, detecting vehicles, road cracks, line markings, and buffer violations across variable conditions.",
                    "source": "YOLOv8/YOLOv12 Object Detection for Drone & Dashcam NH4 Road Survey (Resume Project)"
                },
                {
                    "title": "Fine-Tuned Open-Source LLMs with LangChain RAG",
                    "choice": "Hybrid Open-Source Fine-Tuning + Retrieval Augmentation",
                    "context": "Internal engineering assistance and backend workflow automation require domain-specific terminology handling and grounded documentation access.",
                    "rationale": "Fine-tuning adapts open-source LLMs to company workflow patterns, while LangChain RAG ensures factual context injection from reference documents.",
                    "source": "Nakshatech AI/ML Engineer Workflows (Resume Experience)"
                }
            ],
            "ai_work": [
                {
                    "pillar": "Deep Learning & Transformers from Scratch",
                    "skills": ["PyTorch", "Multi-Head Attention", "Positional Encodings", "Transformer Architecture", "Custom Loss Functions"],
                    "description": "Implemented transformer and GPT architectures from scratch in PyTorch to master internal weight mechanics, attention heatmaps, and optimization dynamics."
                },
                {
                    "pillar": "Geospatial AI & 3D Point Clouds",
                    "skills": ["PointNet++", "Cloth Simulation Filter (CSF)", "LiDAR (.las/.laz)", "Satellite / Drone Analysis", "GeoAI Pipelines"],
                    "description": "Engineered multi-model production pipelines classifying 3D LiDAR point clouds and remote sensing surveys, replacing complex desktop workflows."
                },
                {
                    "pillar": "Computer Vision at Scale",
                    "skills": ["YOLOv8", "YOLOv12", "Object Detection", "Image Processing", "Indian Traffic Datasets"],
                    "description": "Trained custom vision models on 10,000+ real-world highway and urban samples, detecting vehicles, lane degradation, cracks, and safety buffer violations."
                },
                {
                    "pillar": "LLMs, RAG & Agentic Systems",
                    "skills": ["Open-Source LLM Fine-Tuning", "LangChain", "RAG Pipelines", "Prompt Engineering", "Custom Chatbots"],
                    "description": "Built agentic AI workflows and specialized chatbots for backend automation, workflow acceleration, and domain-grounded query answering."
                }
            ],
            "deep_dives": [
                {
                    "title": "NakshAI_LiDAR Software",
                    "metric": "6+ Integrated AI Models",
                    "problem": "Manual geological entity classification in Bentley MicroStation was labor-intensive and required days per survey zone.",
                    "solution": "Built an in-house Python/PyTorch automated GeoAI software platform integrating 6 specialized deep learning models to classify geological entities directly from point clouds.",
                    "tech": ["Python", "PyTorch", "GeoAI", "Point Clouds", "CSF"]
                },
                {
                    "title": "PointNet++ Semantic LiDAR Segmentation",
                    "metric": "3D Feature Extraction Pipeline",
                    "problem": "Unorganized 3D point clouds with variable density require learning both fine-grained geometric neighborhoods and spatial context.",
                    "solution": "Implemented hierarchical PointNet++ with CSF-derived height metrics, enabling the model to learn local topological structures from raw .las/.laz point clouds.",
                    "tech": ["PyTorch", "PointNet++", "Cloth Simulation Filter", "LiDAR"]
                },
                {
                    "title": "Drone & Dashcam Road Survey Detection",
                    "metric": "NH4 Corridor Highway Survey",
                    "problem": "Highway survey footage suffered from variable weather, shadow artifacts, and high visual density along the NH4 Karnataka corridor.",
                    "solution": "Trained tailored YOLOv8/YOLOv12 architectures capable of detecting cracks, road-line degradation, buffer violations, and multi-class vehicles under challenging conditions.",
                    "tech": ["YOLOv8", "YOLOv12", "Computer Vision", "Video Processing"]
                },
                {
                    "title": "Bangalore Traffic Density Dashboard",
                    "metric": "10,000 Indian Vehicle Samples",
                    "problem": "Standard pre-trained vision models struggled on Indian urban traffic due to distinctive vehicle types and chaotic traffic flows.",
                    "solution": "Curated and annotated a custom 10k Indian vehicle dataset, trained a specialized detector, and connected it to an interactive temporal density analytics dashboard.",
                    "tech": ["YOLO", "Dataset Annotation", "Analytics Dashboard", "Python"]
                }
            ]
        }
    },

    # Live GitHub data is fetched server-side via the GraphQL API when
    # GITHUB_TOKEN is set (see services/github.py). `fallback_repos` is only
    # used when no token is configured — leave it empty to show a tasteful
    # "connect a token" state instead of inventing repositories.
    "github": {
        "username": "Sanketx125",
        "fallback_repos": [
            {
                "name": "GDB-Engine-for-QGIS-limitations-",
                "description": "Extends QGIS workflows for ESRI File GDB workspace domains, cascading class/subclass relationships, and ArcCatalog-style domain inspection.",
                "url": "https://github.com/Sanketx125/GDB-Engine-for-QGIS-limitations-",
            },
            {
                "name": "Deep-Learning.-PointNet-Architecture-of-LiDAR-data-Classification",
                "description": "PointNet-based deep-learning work for LiDAR point-cloud classification.",
                "url": "https://github.com/Sanketx125/Deep-Learning.-PointNet-Architecture-of-LiDAR-data-Classification",
            },
        ],
    },

    "resume": {
        "summary": (
            "AI/ML engineer building production systems where geospatial data, "
            "computer vision, and LLMs meet — from LiDAR point clouds and "
            "satellite imagery to RAG and agentic AI."
        ),
        "highlights": [
            "3+ years building production AI/ML and geospatial systems",
            "Shipped a 6-model LiDAR classification pipeline for Nakshatech",
            "Fine-tuned open source LLMs and shipped RAG / agentic workflows in LangChain",
            "Trained a 10k-sample vehicle detector for city-scale traffic analysis",
            "Recipient of Nakshatech's Code Catalyst Award",
        ],
    },

    "resume_pdf": "files/resume.pdf",
}

# ==============================================================================
# AUTHORITATIVE PROFESSIONAL FACT REGISTRY
# Every fact is classified by provenance and verification status.
# Only verified == True facts may be presented publicly or fed to AI prompts.
# ==============================================================================
PROFESSIONAL_FACTS = [
    {
        "id": "fact_name",
        "category": "profile",
        "claim": "Sanket Uday Mane is an AI/ML Engineer.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:header",
    },
    {
        "id": "fact_email",
        "category": "profile",
        "claim": "Email address is Sanketx125@gmail.com.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:header",
    },
    {
        "id": "fact_phone",
        "category": "profile",
        "claim": "Phone number is +91 9172180301.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:header",
    },
    {
        "id": "fact_github",
        "category": "profile",
        "claim": "GitHub profile is https://github.com/Sanketx125.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:header",
    },
    {
        "id": "fact_linkedin",
        "category": "profile",
        "claim": "LinkedIn profile is https://www.linkedin.com/in/sanket-mane-784a01216/.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:header",
    },
    {
        "id": "fact_role_nakshatech",
        "category": "experience",
        "claim": "AI/ML Engineer at Nakshatech Pvt Ltd, Bangalore, Karnataka from Oct 2025 to Present.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:experience",
    },
    {
        "id": "fact_exp_nakshatech_tasks",
        "category": "experience",
        "claim": "Develops and trains deep learning models for detection and segmentation on satellite/drone imagery and LiDAR data, handling large-scale data preprocessing and annotation for GeoAI workflows at Nakshatech.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:experience",
    },
    {
        "id": "fact_exp_nakshatech_llm",
        "category": "experience",
        "claim": "Fine-tuned open-source LLMs for backend automation and a custom internal chatbot, and built RAG-based agentic AI workflows using LangChain and prompt engineering at Nakshatech.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:experience",
    },
    {
        "id": "fact_exp_nakshatech_r_and_d",
        "category": "experience",
        "claim": "Accelerates development speed and issue resolution using AI-assisted debugging, AI data analytics, custom GPTs, and AI automation; performs structured R&D before initiatives.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:experience",
    },
    {
        "id": "fact_role_phn",
        "category": "experience",
        "claim": "Machine Learning Engineer Intern at PHN Technology Pvt Ltd, Pune, Maharashtra from Oct 2023 to Mar 2024.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:experience",
    },
    {
        "id": "fact_role_qconnect",
        "category": "experience",
        "claim": "Technical Support Executive (System Engineer) at Q-connect Business Solution, Pune, Maharashtra from Dec 2022 to Jun 2023.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:experience",
    },
    {
        "id": "fact_education",
        "category": "education",
        "claim": "Bachelor of Engineering (B.E.) in Information Technology from Savitribai Phule Pune University (SPPU), Sept 2021 to Mar 2024, CGPA 7.46/10.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:education",
    },
    {
        "id": "fact_education_coursework",
        "category": "education",
        "claim": "Relevant Coursework: Data Structures and Algorithms, Databases, Operating Systems, Computer Networks, Machine Learning, Deep Learning, Data Science, Image Processing.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:education",
    },
    {
        "id": "fact_award_code_catalyst",
        "category": "award",
        "claim": "Code Catalyst Award: recognized on Nakshatech's 14th Anniversary Award of Recognition (2026-27).",
        "source": "user-provided LinkedIn award post photo:trophy engraving",
        "provenance": "linkedin_evidence",
        "original_source_wording": {"resume_claim": "CODE CATELYST Award"},
        "verified": True,
        "verified_at": "2026-09-18",
        "evidence_target": "static/files/resume.pdf:p1:awards",
    },
    {
        "id": "fact_mentorship_college",
        "category": "social",
        "claim": "Mentor at College: Helping junior students and working professionals to get better at problem solving, coding, Machine Learning and Deep Learning.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:awards",
    },
    {
        "id": "fact_proj_pointnet",
        "category": "project",
        "claim": "PointNet++ Architecture for LiDAR Data Classification: Built an end-to-end pipeline for semantic classification of 3D LiDAR point clouds (.laz/.las) with custom PointNet++ and advanced feature extraction using Cloth Simulation Filter-based height metrics.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:project_work",
    },
    {
        "id": "fact_proj_nakshai_lidar",
        "category": "project",
        "claim": "NakshAI_LiDAR Software: Developed geospatial software for classification of geological entities as an alternative to Bentley MicroStation, integrating 6+ AI models to speed up classification and reduce manual effort.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:project_work",
    },
    {
        "id": "fact_proj_road_survey",
        "category": "project",
        "claim": "YOLOv8/YOLOv12 Object Detection for Drone & Dashcam NH4 Road Survey: Developed an object detection solution for vehicles, road damage, buffer zones, road cracks, and road-line condition analysis.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:project_work",
    },
    {
        "id": "fact_proj_traffic",
        "category": "project",
        "claim": "Traffic Density Analysis for Bangalore City: Developed a traffic density dashboard for class-wise vehicle detection and time-based density estimation using a model trained on 10k Indian vehicle samples.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:project_work",
    },
    {
        "id": "fact_skills_core",
        "category": "technical",
        "claim": "Core skills: Python, C++, SQL/MySQL, Machine Learning, Deep Learning, GenAI, Data Preprocessing & Annotation, Data Analysis.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:skills",
    },
    {
        "id": "fact_skills_tools",
        "category": "technical",
        "claim": "Tools: PyTorch, scikit-learn, NumPy, Pandas, Matplotlib, Seaborn, Flask, Git/GitHub, VS Code, Jupyter Notebook, LangChain, YOLOv8/YOLOv12, Image Processing.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:skills",
    },
    {
        "id": "fact_skills_genai",
        "category": "technical",
        "claim": "GenAI & LLMs: Transformer/GPT architecture from scratch (PyTorch), LLM fine-tuning, RAG, Agentic AI (LangChain), Prompt Engineering, Custom Chatbots.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:skills",
    },
    {
        "id": "fact_skills_debugging",
        "category": "technical",
        "claim": "AI Process & Debugging: AI-assisted debugging, reverse engineering, crash analysis, silent failure diagnosis, memory leak troubleshooting, AI automation.",
        "source": "RESUME",
        "verified": True,
        "verified_at": "2026-03-01",
        "evidence_target": "static/files/resume.pdf:p1:skills",
    },
    # Unverified claims: explicit registry tracking with verified=False
    {
        "id": "unverified_linkedin_followers",
        "category": "social",
        "claim": "1,200+ LinkedIn followers",
        "source": "UNVERIFIED",
        "verified": False,
        "verified_at": None,
        "evidence_target": "Requires user verification screenshot",
    },
    {
        "id": "unverified_linkedin_impressions",
        "category": "social",
        "claim": "10,000+ technical impressions",
        "source": "UNVERIFIED",
        "verified": False,
        "verified_at": None,
        "evidence_target": "Requires user verification screenshot",
    },
    {
        "id": "unverified_mentees_count",
        "category": "social",
        "claim": "40+ engineering mentees",
        "source": "UNVERIFIED",
        "verified": False,
        "verified_at": None,
        "evidence_target": "Requires user verification evidence",
    },
    {
        "id": "unverified_lidar_95_accuracy",
        "category": "metric",
        "claim": "95%+ LiDAR classification accuracy",
        "source": "UNVERIFIED",
        "verified": False,
        "verified_at": None,
        "evidence_target": "Requires benchmark evaluation log / dataset split",
    },
    {
        "id": "unverified_traffic_96_accuracy",
        "category": "metric",
        "claim": "96%+ vehicle detection accuracy",
        "source": "UNVERIFIED",
        "verified": False,
        "verified_at": None,
        "evidence_target": "Requires benchmark evaluation log / dataset split",
    },
]


def get_verified_facts():
    """Return display/prompt facts whose claim and provenance meet policy."""
    metric_provenance = {"measured_result", "benchmark_artifact", "client_report"}
    return [
        fact for fact in PROFESSIONAL_FACTS
        if fact.get("verified") is True
        and (fact.get("category") != "metric" or fact.get("provenance") in metric_provenance)
    ]


# Existing resume-backed records remain valid public descriptions, but their
# evidence quality is explicit. A boolean alone never upgrades a metric.
for _fact in PROFESSIONAL_FACTS:
    _fact.setdefault("provenance", "resume_claim" if _fact.get("source") == "RESUME" else "unverified")


# Positive allow-list: a capability is demonstrated only when every referenced
# record resolves to a verified, prompt-eligible fact above.
VERIFIED_CAPABILITY_REGISTRY = [
    {"id": "cap_pytorch", "label": "PyTorch", "aliases": ["pytorch", "torch"], "evidence_ids": ["fact_skills_tools", "fact_proj_pointnet"]},
    {"id": "cap_computer_vision", "label": "Computer Vision", "aliases": ["computer vision", "image processing", "detection", "segmentation"], "evidence_ids": ["fact_skills_tools", "fact_proj_road_survey"]},
    {"id": "cap_yolo", "label": "YOLO (v8/v12)", "aliases": ["yolo", "yolov8", "yolov12", "object detection"], "evidence_ids": ["fact_skills_tools", "fact_proj_road_survey"]},
    {"id": "cap_lidar", "label": "LiDAR / Point Cloud", "aliases": ["lidar", "point cloud", "pointnet", ".las", ".laz", "3d vision"], "evidence_ids": ["fact_proj_pointnet", "fact_proj_nakshai_lidar"]},
    {"id": "cap_geospatial", "label": "Geospatial AI / Remote Sensing", "aliases": ["geospatial", "geoai", "remote sensing", "satellite", "drone", "gis"], "evidence_ids": ["fact_exp_nakshatech_tasks"]},
    {"id": "cap_csf", "label": "Cloth Simulation Filter (CSF)", "aliases": ["cloth simulation", "csf", "height metric", "terrain"], "evidence_ids": ["fact_proj_pointnet"]},
    {"id": "cap_llm", "label": "LLMs & Fine-Tuning", "aliases": ["llm", "llms", "fine-tuning", "finetuning", "transformer", "gpt"], "evidence_ids": ["fact_exp_nakshatech_llm", "fact_skills_genai"]},
    {"id": "cap_rag", "label": "LangChain & RAG", "aliases": ["langchain", "rag", "retrieval", "agentic", "chatbot"], "evidence_ids": ["fact_exp_nakshatech_llm", "fact_skills_genai"]},
    {"id": "cap_python", "label": "Python", "aliases": ["python", "numpy", "pandas", "scikit-learn"], "evidence_ids": ["fact_skills_core", "fact_skills_tools"]},
    {"id": "cap_deep_learning", "label": "Deep Learning Architectures", "aliases": ["deep learning", "neural network", "attention"], "evidence_ids": ["fact_skills_core", "fact_skills_genai"]},
    {"id": "cap_pipeline", "label": "Production Pipeline Delivery", "aliases": ["production pipeline", "pipeline", "deployment"], "evidence_ids": ["fact_proj_nakshai_lidar"]},
    {"id": "cap_debugging", "label": "AI-Assisted Debugging & Structured R&D", "aliases": ["debugging", "troubleshooting", "rapid prototyping", "problem solving", "r&d"], "evidence_ids": ["fact_skills_debugging"]},
]


def get_verified_capabilities():
    verified_ids = {fact["id"] for fact in get_verified_facts()}
    return [cap for cap in VERIFIED_CAPABILITY_REGISTRY if cap["evidence_ids"] and all(eid in verified_ids for eid in cap["evidence_ids"])]


CONTENT["verified_capabilities"] = get_verified_capabilities()
