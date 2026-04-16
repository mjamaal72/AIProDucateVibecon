{
  "brand": {
    "product_name": "AIProDucate",
    "design_personality": [
      "Material 3-inspired (tonal surfaces, clear hierarchy)",
      "Professional + academic trust",
      "Card-first dashboards with gentle elevation",
      "Distraction-free exam mode"
    ],
    "north_star": "Make high-stakes evaluation workflows feel calm, predictable, and auditable—every action has feedback, every state is visible."
  },

  "design_tokens": {
    "notes": [
      "Use CSS variables in index.css (:root) to override shadcn defaults.",
      "Primary must remain Navy #1e3a5f (logo match).",
      "Avoid heavy gradients; if used, keep to hero/header decorative areas only (<20% viewport)."
    ],

    "css_custom_properties": {
      "colors": {
        "--background": "210 33% 98%",
        "--foreground": "215 28% 14%",

        "--card": "0 0% 100%",
        "--card-foreground": "215 28% 14%",

        "--popover": "0 0% 100%",
        "--popover-foreground": "215 28% 14%",

        "--primary": "210 52% 25%",
        "--primary-foreground": "210 40% 98%",

        "--secondary": "210 30% 96%",
        "--secondary-foreground": "215 28% 18%",

        "--muted": "210 24% 95%",
        "--muted-foreground": "215 12% 45%",

        "--accent": "204 55% 92%",
        "--accent-foreground": "210 52% 22%",

        "--border": "214 20% 88%",
        "--input": "214 20% 88%",
        "--ring": "210 52% 25%",

        "--destructive": "0 72% 52%",
        "--destructive-foreground": "0 0% 98%",

        "--success": "142 52% 38%",
        "--warning": "38 92% 50%",
        "--info": "204 80% 40%",

        "--exam-answered": "142 52% 38%",
        "--exam-bookmarked": "38 92% 50%",
        "--exam-unattended": "215 10% 70%",

        "--sidebar": "210 52% 18%",
        "--sidebar-foreground": "210 40% 96%",
        "--sidebar-muted": "210 30% 26%",
        "--sidebar-active": "204 55% 92%",
        "--sidebar-active-foreground": "210 52% 18%"
      },

      "radii": {
        "--radius": "0.75rem",
        "--radius-sm": "0.625rem",
        "--radius-lg": "1rem"
      },

      "shadows": {
        "--shadow-1": "0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 1px rgba(16, 24, 40, 0.04)",
        "--shadow-2": "0 6px 16px rgba(16, 24, 40, 0.10)",
        "--shadow-3": "0 12px 28px rgba(16, 24, 40, 0.14)"
      },

      "spacing": {
        "--space-1": "0.25rem",
        "--space-2": "0.5rem",
        "--space-3": "0.75rem",
        "--space-4": "1rem",
        "--space-5": "1.25rem",
        "--space-6": "1.5rem",
        "--space-8": "2rem",
        "--space-10": "2.5rem",
        "--space-12": "3rem"
      }
    }
  },

  "typography": {
    "font_pairing": {
      "display": {
        "family": "Space Grotesk",
        "usage": "App shell titles, page headings, KPI numbers"
      },
      "body": {
        "family": "Inter",
        "usage": "Forms, tables, helper text, long reading"
      },
      "mono_optional": {
        "family": "IBM Plex Mono",
        "usage": "Exam codes, evaluation IDs, audit logs"
      }
    },
    "google_fonts_import": [
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
    ],
    "type_scale_tailwind": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight",
      "h2": "text-base md:text-lg font-medium text-muted-foreground",
      "section_title": "text-lg font-semibold tracking-tight",
      "body": "text-sm md:text-base",
      "small": "text-xs text-muted-foreground"
    },
    "line_height": {
      "default": "leading-6",
      "dense_tables": "leading-5"
    }
  },

  "layout": {
    "app_shell": {
      "pattern": "Sidebar + top header + content",
      "sidebar_width": "w-[280px] (desktop), collapsible to icons-only w-[76px]",
      "content_max_width": "max-w-[1400px] for dense dashboards; full width for tables",
      "page_padding": "px-4 sm:px-6 lg:px-8 py-6",
      "grid": {
        "dashboard": "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4 lg:gap-6",
        "kpi_cards": "col-span-12 xl:col-span-3",
        "main_panel": "col-span-12 xl:col-span-8",
        "side_panel": "col-span-12 xl:col-span-4"
      }
    },
    "exam_mode": {
      "pattern": "Distraction-free: minimal header, sticky timer, right-side nav grid on desktop",
      "desktop": "grid grid-cols-12 gap-6",
      "question_panel": "col-span-12 lg:col-span-8",
      "nav_panel": "col-span-12 lg:col-span-4",
      "mobile": "Timer sticky top; nav grid in bottom sheet (shadcn Drawer)"
    }
  },

  "color_system_usage": {
    "primary_navy": "#1e3a5f",
    "accent_strategy": [
      "Use light sky/ice accents for selection states (background tints), not saturated gradients.",
      "Reserve strong color for primary buttons, active nav item, focus ring.",
      "Use semantic colors for exam status + moderation states."
    ],
    "exam_status_colors": {
      "answered": {
        "bg": "bg-[hsl(var(--exam-answered))]/15",
        "border": "border-[hsl(var(--exam-answered))]/35",
        "text": "text-[hsl(var(--exam-answered))]",
        "icon": "Check"
      },
      "bookmarked": {
        "bg": "bg-[hsl(var(--exam-bookmarked))]/15",
        "border": "border-[hsl(var(--exam-bookmarked))]/35",
        "text": "text-[hsl(var(--exam-bookmarked))]",
        "icon": "Bookmark"
      },
      "unattended": {
        "bg": "bg-muted",
        "border": "border-border",
        "text": "text-muted-foreground",
        "icon": "Circle"
      }
    }
  },

  "components": {
    "component_path": {
      "navigation": [
        "/app/frontend/src/components/ui/tabs.jsx",
        "/app/frontend/src/components/ui/navigation-menu.jsx",
        "/app/frontend/src/components/ui/breadcrumb.jsx",
        "/app/frontend/src/components/ui/sheet.jsx",
        "/app/frontend/src/components/ui/drawer.jsx"
      ],
      "surfaces": [
        "/app/frontend/src/components/ui/card.jsx",
        "/app/frontend/src/components/ui/separator.jsx",
        "/app/frontend/src/components/ui/scroll-area.jsx",
        "/app/frontend/src/components/ui/resizable.jsx"
      ],
      "forms": [
        "/app/frontend/src/components/ui/form.jsx",
        "/app/frontend/src/components/ui/input.jsx",
        "/app/frontend/src/components/ui/textarea.jsx",
        "/app/frontend/src/components/ui/select.jsx",
        "/app/frontend/src/components/ui/checkbox.jsx",
        "/app/frontend/src/components/ui/radio-group.jsx",
        "/app/frontend/src/components/ui/switch.jsx",
        "/app/frontend/src/components/ui/calendar.jsx"
      ],
      "feedback": [
        "/app/frontend/src/components/ui/sonner.jsx",
        "/app/frontend/src/components/ui/tooltip.jsx",
        "/app/frontend/src/components/ui/alert.jsx",
        "/app/frontend/src/components/ui/alert-dialog.jsx",
        "/app/frontend/src/components/ui/progress.jsx",
        "/app/frontend/src/components/ui/skeleton.jsx"
      ],
      "data_display": [
        "/app/frontend/src/components/ui/table.jsx",
        "/app/frontend/src/components/ui/badge.jsx",
        "/app/frontend/src/components/ui/avatar.jsx",
        "/app/frontend/src/components/ui/pagination.jsx",
        "/app/frontend/src/components/ui/accordion.jsx",
        "/app/frontend/src/components/ui/collapsible.jsx"
      ],
      "overlays": [
        "/app/frontend/src/components/ui/dialog.jsx",
        "/app/frontend/src/components/ui/popover.jsx",
        "/app/frontend/src/components/ui/dropdown-menu.jsx",
        "/app/frontend/src/components/ui/hover-card.jsx",
        "/app/frontend/src/components/ui/context-menu.jsx"
      ]
    },

    "component_recipes": {
      "sidebar_nav_item": {
        "base": "group flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium text-[hsl(var(--sidebar-foreground))]/80 hover:text-[hsl(var(--sidebar-foreground))] hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sidebar-active))]",
        "active": "bg-[hsl(var(--sidebar-active))] text-[hsl(var(--sidebar-active-foreground))] shadow-[var(--shadow-1)]",
        "icon": "text-[hsl(var(--sidebar-foreground))]/70 group-hover:text-[hsl(var(--sidebar-foreground))]"
      },

      "card_elevation": {
        "default": "bg-card border border-border rounded-[var(--radius)] shadow-[var(--shadow-1)]",
        "hover": "hover:shadow-[var(--shadow-2)] hover:-translate-y-[1px]",
        "motion": "transition-shadow transition-transform duration-200"
      },

      "primary_button": {
        "class": "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-1)] hover:shadow-[var(--shadow-2)] hover:bg-[hsl(var(--primary))]/95 active:scale-[0.98]",
        "focus": "focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2",
        "motion": "transition-shadow transition-colors duration-200"
      },

      "secondary_button": {
        "class": "bg-white border border-border text-foreground hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
        "motion": "transition-colors duration-200"
      },

      "table_density": {
        "header": "bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground",
        "row": "hover:bg-muted/40",
        "cell": "py-3"
      },

      "skeleton_loading": {
        "rule": "Use Skeleton for cards, tables, and exam question loading. Avoid spinners.",
        "patterns": [
          "KPI card: 3 skeleton lines + 1 big number block",
          "Table: skeleton rows with varying widths",
          "Exam question: skeleton for stem + options"
        ]
      }
    }
  },

  "page_blueprints": {
    "login": {
      "layout": "Split layout: left brand panel (logo + value props), right auth card",
      "left_panel": "hidden on mobile; on desktop use subtle navy-to-ice background (decorative only)",
      "auth_card": "Card with shadow-1, max-w-md, includes SSO placeholders",
      "required_testids": [
        "login-email-input",
        "login-password-input",
        "login-submit-button",
        "login-forgot-password-link"
      ]
    },

    "dashboard_tabs": {
      "tabs": [
        "Evaluation Management",
        "Question Bank",
        "Manual Correction",
        "Leaders Board & Item Analysis",
        "Student Portal"
      ],
      "header": "Top header includes breadcrumb, global search (Command), notifications, profile",
      "sidebar": "Lucide icons + labels; collapsible; active item uses sidebar-active tint",
      "required_testids": [
        "app-sidebar",
        "app-topbar",
        "sidebar-nav-evaluation-management",
        "sidebar-nav-question-bank",
        "sidebar-nav-manual-correction",
        "sidebar-nav-leaderboard-item-analysis",
        "sidebar-nav-student-portal"
      ]
    },

    "evaluation_management": {
      "primary_view": "Card grid of evaluations + table toggle",
      "card_fields": "Title, course, date window, status badge, assigned examiners count",
      "primary_actions": [
        "Create Evaluation",
        "Allocate Examiners",
        "Publish/Unpublish"
      ],
      "modals": [
        "Create/Edit Evaluation (Dialog)",
        "Section Management (Dialog)",
        "Examiner Allocation (Sheet for wide tables)"
      ],
      "required_testids": [
        "evaluation-create-button",
        "evaluation-search-input",
        "evaluation-card",
        "evaluation-card-open-button",
        "evaluation-publish-toggle"
      ]
    },

    "question_bank": {
      "layout": "Two-pane: left filters + list, right editor/preview",
      "ai_generation": "AI Generate button opens Dialog with prompt, difficulty, outcomes, question type",
      "question_types": "9 builders; each builder uses Accordion sections for settings + grading",
      "required_testids": [
        "question-bank-ai-generate-button",
        "question-bank-filter-panel",
        "question-editor-save-button",
        "question-type-select"
      ]
    },

    "manual_correction": {
      "layout": "Table-first with sticky filters row; row click opens Drawer with student response + rubric",
      "rubric": "Use Tabs: Response | Rubric | History",
      "required_testids": [
        "manual-correction-table",
        "manual-correction-filter-status",
        "manual-correction-open-drawer",
        "manual-correction-score-input",
        "manual-correction-submit-button"
      ]
    },

    "leaderboard_item_analysis": {
      "layout": "Tabs inside page: Leaderboard | Item Analysis",
      "leaderboard": "Table with rank, student, score, time taken; top 3 highlighted with subtle tint",
      "item_analysis": "Charts (Recharts) for difficulty, discrimination, option distribution",
      "required_testids": [
        "leaderboard-table",
        "item-analysis-tab",
        "item-analysis-chart"
      ]
    },

    "student_portal": {
      "layout": "Upcoming exams cards + past attempts table",
      "exam_card": "Shows time window, duration, rules, start button",
      "required_testids": [
        "student-upcoming-exams",
        "student-exam-start-button",
        "student-past-attempts-table"
      ]
    },

    "live_exam_interface": {
      "layout": "Left: question; Right: navigation grid + legend + submit",
      "timer": "Sticky top timer chip; shows remaining time; turns warning color at <5 min",
      "nav_grid": "Grid of numbered buttons with status styles + icons; includes legend",
      "controls": "Prev/Next, Bookmark toggle, Clear answer, Save & Next",
      "anti_distraction": [
        "Hide global sidebar/topbar",
        "Use neutral background",
        "Keep only essential actions visible"
      ],
      "required_testids": [
        "exam-timer",
        "exam-question-stem",
        "exam-answer-input",
        "exam-save-next-button",
        "exam-bookmark-toggle",
        "exam-nav-grid",
        "exam-nav-grid-item",
        "exam-submit-button"
      ]
    }
  },

  "motion_microinteractions": {
    "principles": [
      "Use motion to confirm state changes (save, publish, allocate) and to guide attention (timer warning).",
      "Prefer subtle transforms (1-2px lift) + shadow changes; avoid large bounces.",
      "Respect prefers-reduced-motion."
    ],
    "recommended_library": {
      "name": "framer-motion",
      "why": "Entrance animations for cards, drawer transitions, exam nav grid feedback",
      "install": "npm i framer-motion",
      "usage_notes": [
        "AnimatePresence for Dialog/Drawer content transitions",
        "motion.div for card hover lift (whileHover={{ y: -1 }})"
      ]
    },
    "interaction_specs": {
      "card_hover": "shadow-1 -> shadow-2, translateY -1px, duration 200ms",
      "button_press": "active:scale-[0.98] (no transition-all)",
      "sidebar_active": "background tint fade-in 150ms",
      "exam_nav_click": "brief ring pulse (box-shadow) 120ms"
    }
  },

  "data_viz": {
    "library": "recharts",
    "install": "npm i recharts",
    "chart_style": {
      "grid": "stroke: hsl(var(--border))",
      "axis": "tick fill: hsl(var(--muted-foreground))",
      "series": [
        "navy: hsl(var(--primary))",
        "ice: hsl(var(--info))",
        "success: hsl(var(--success))",
        "warning: hsl(var(--warning))"
      ]
    },
    "empty_states": "Use Card with icon + 1 sentence + CTA; never blank charts."
  },

  "accessibility": {
    "requirements": [
      "WCAG AA contrast for text and interactive elements.",
      "Never rely on color alone for exam status: include icon + sr-only label.",
      "Focus-visible rings must be clearly visible on navy and light surfaces.",
      "Keyboard navigation: sidebar, tables, exam nav grid must be reachable and logical."
    ],
    "exam_colorblind_support": {
      "answered": "Add check icon",
      "bookmarked": "Add bookmark icon",
      "unattended": "Add hollow circle icon"
    }
  },

  "images": {
    "logo": {
      "category": "brand",
      "description": "Primary logo used in sidebar header and login page",
      "url": "https://customer-assets.emergentagent.com/job_8fd771a9-94bf-48e9-839d-945bcffab523/artifacts/0npssl6s_AIProDucate%20Logo.jpeg"
    },
    "image_urls": [
      {
        "category": "login-left-panel-background",
        "description": "Abstract geometric pattern; use as subtle masked background with low opacity (5-8%)",
        "url": "https://images.unsplash.com/photo-1605106250963-ffda6d2a4b32?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
      },
      {
        "category": "student-portal-hero-card",
        "description": "Modern campus/building photo for student portal welcome card; apply rounded corners + overlay tint",
        "url": "https://images.unsplash.com/photo-1598463035674-3ded88d65be2?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
      },
      {
        "category": "empty-state-illustration",
        "description": "Use abstract pattern as fallback illustration for empty states (no data yet)",
        "url": "https://images.unsplash.com/photo-1605106702842-01a887a31122?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
      }
    ]
  },

  "implementation_notes_js": {
    "react_files": "Project uses .js (not .tsx). Keep components in JS, use prop-types only if already present.",
    "data_testid_rule": "Every button/input/link/table row action must include data-testid in kebab-case.",
    "toast": {
      "library": "sonner",
      "component_path": "/app/frontend/src/components/ui/sonner.jsx",
      "rule": "Toast on create/update/delete/publish/submit/allocate actions; include success + undo where safe."
    },
    "no_universal_transition": "Never use transition-all; use transition-colors, transition-shadow, transition-opacity, transition-transform selectively (avoid transform transitions that break)."
  },

  "instructions_to_main_agent": [
    "Replace default shadcn tokens in /app/frontend/src/index.css :root with the provided HSL values; keep dark mode optional but not default.",
    "Remove any centered App defaults from App.css; App.css currently contains CRA boilerplate—prefer Tailwind + tokens.",
    "Build an AppShell layout: Sidebar (collapsible) + Topbar + Content; hide shell in Live Exam route.",
    "Use Card + Skeleton patterns everywhere for loading; no spinners.",
    "Implement exam nav grid with status colors (answered/bookmarked/unattended) + icons + legend; ensure colorblind support.",
    "Use Dialog for create/edit flows; use Sheet/Drawer for dense tables and mobile exam nav.",
    "Add Framer Motion for subtle entrance/hover animations; respect prefers-reduced-motion.",
    "Add Recharts for Item Analysis; style charts with tokens and provide empty states.",
    "Ensure every interactive element has data-testid (kebab-case)."
  ],

  "general_ui_ux_design_guidelines": "- You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals."
}
