/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './src/pages/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'fade-in': {
  				'0%': {
  					opacity: '0'
  				},
  				'100%': {
  					opacity: '1'
  				}
  			},
  			'slide-in-from-top': {
  				'0%': {
  					transform: 'translateY(-100%)'
  				},
  				'100%': {
  					transform: 'translateY(0)'
  				}
  			},
  			'slide-in-from-bottom': {
  				'0%': {
  					transform: 'translateY(100%)'
  				},
  				'100%': {
  					transform: 'translateY(0)'
  				}
  			},
  			'scale-in': {
  				'0%': {
  					transform: 'scale(0.95)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'scale(1)',
  					opacity: '1'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'fade-in': 'fade-in 0.3s ease-out',
  			'slide-in-from-top': 'slide-in-from-top 0.3s ease-out',
  			'slide-in-from-bottom': 'slide-in-from-bottom 0.3s ease-out',
  			'scale-in': 'scale-in 0.2s ease-out'
  		},
  		fontFamily: {
  			sans: [
  				'Inter',
  				'system-ui',
  				'sans-serif'
  			],
  			mono: [
  				'JetBrains Mono',
  				'monospace'
  			]
  		},
  		spacing: {
  			'18': '4.5rem',
  			'88': '22rem',
  			'128': '32rem'
  		},
  		maxWidth: {
  			'8xl': '88rem',
  			'9xl': '96rem'
  		},
  		minHeight: {
  			'screen-75': '75vh'
  		},
  		fontSize: {
  			'55': '55rem'
  		},
  		opacity: {
  			'80': '.8'
  		},
  		zIndex: {
  			'2': 2,
  			'3': 3
  		},
  		inset: {
  			'-100': '-100%',
  			'-225-px': '-225px',
  			'-160-px': '-160px',
  			'-150-px': '-150px',
  			'-94-px': '-94px',
  			'-50-px': '-50px',
  			'-29-px': '-29px',
  			'-20-px': '-20px',
  			'25-px': '25px',
  			'40-px': '40px',
  			'95-px': '95px',
  			'145-px': '145px',
  			'195-px': '195px',
  			'210-px': '210px',
  			'260-px': '260px'
  		},
  		height: {
  			'95-px': '95px',
  			'70-px': '70px',
  			'350-px': '350px',
  			'500-px': '500px',
  			'600-px': '600px'
  		},
  		maxHeight: {
  			'860-px': '860px'
  		},
  		minWidth: {
  			'140-px': '140px',
  			'48': '12rem'
  		},
  		backgroundSize: {
  			full: '100%'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
