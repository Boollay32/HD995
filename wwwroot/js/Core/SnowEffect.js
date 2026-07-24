// =============================  SnowEffect.js  ============================= //
// Snow renderer, rewritten clean (v3). One requestAnimationFrame loop drives
// every flake with fractional translate() per frame: main-thread repaints
// (no compositor dependency, works under software rendering) with sub-pixel
// smoothness. No CSS keyframe motion, no seasonal logic - Snow.js owns
// gating and lifecycle; this class only renders.
//
//   new SnowEffect({ navbarOnly: true, snowflakeCount: 28 })
//   .init()   build container + flakes, start the loop
//   .stop()   cancel the loop, remove the container
//   .toggle() convenience flip
//
// Modes: navbarOnly renders a 56px strip over the nav (#navbar-snow);
// otherwise a full-viewport fall (#snow-overlay) tuned sparser and slower
// relative to its height. Flake visuals (size, colour, light-mode shading)
// come from Snow.css via the depth classes; motion and opacity come from
// this loop.

class SnowEffect {
    constructor(options = {}) {
        this.navbarOnly = options.navbarOnly !== false;
        this.count = options.snowflakeCount || (this.navbarOnly ? 28 : 30);
        this.container = null;
        this._raf = null;
        this._t0 = null;
        this._flakes = null;
    }

    init() {
        if (this.container) return;                       // already running
        document.getElementById('navbar-snow')?.remove(); // never stack containers
        document.getElementById('snow-overlay')?.remove();

        this.container = document.createElement('div');
        this.container.id = this.navbarOnly ? 'navbar-snow' : 'snow-overlay';
        document.body.appendChild(this.container);

        // Mode-tuned motion. Full-page opacity ceilings are lower so a whole
        // screen of snow still reads as subtle.
        const nav = this.navbarOnly;
        const SPEED = nav ? { near: 12, medium: 8.5, far: 5.5 }
                          : { near: 26, medium: 18,  far: 12 };   // px/s fall
        const MAXO  = nav ? { near: 0.95, medium: 0.8,  far: 0.6 }
                          : { near: 0.85, medium: 0.65, far: 0.45 };
        const LEAD = nav ? 8 : 10;              // spawn height above the frame
        const H = nav ? 56 : Math.max(400, window.innerHeight || 800);
        this._geom = {
            TRAVEL: nav ? 62 : H + 2 * LEAD,
            LEAD,
            FADE_IN_END:    nav ? 10 : 24,
            FADE_OUT_START: nav ? 38 : H - 70,
            FADE_OUT_END:   nav ? 52 : H - 20
        };

        this._flakes = [];
        for (let i = 0; i < this.count; i++) {
            const r = Math.random();
            const depth = r < 0.3 ? 'near' : r < 0.7 ? 'medium' : 'far';
            const el = document.createElement('div');
            el.className = 'snowflake ' + depth + (Math.random() < 0.2 ? ' sparkle' : '');
            el.style.left = (Math.random() * 100) + '%';
            el.style.opacity = '0';                        // no first-frame flash
            this.container.appendChild(el);
            this._flakes.push({
                el,
                speed: SPEED[depth] * (0.85 + Math.random() * 0.3),
                phase: Math.random() * this._geom.TRAVEL,
                drift: nav ? 0.9 + Math.random() * 0.7
                           : 4 + Math.random() * 3,        // px/s rightward wind
                swayAmp: nav ? 0.8 + Math.random() * 1.2
                             : 1.2 + Math.random() * 2,
                swayHz: 0.15 + Math.random() * 0.2,
                swayOff: Math.random() * 6.283,
                max: MAXO[depth]
            });
        }

        this._t0 = null;
        this._raf = requestAnimationFrame((ts) => this._tick(ts));
    }

    _tick(ts) {
        if (!this.container) return;                       // stopped mid-flight
        if (this._t0 === null) this._t0 = ts;
        const t = (ts - this._t0) / 1000;
        const g = this._geom;
        for (const f of this._flakes) {
            const cyc = (t * f.speed + f.phase) % g.TRAVEL;
            const y = cyc - g.LEAD;
            // Wind: steady rightward drift over this fall's elapsed time plus
            // a faint sway; resets with the cycle while opacity is 0.
            const x = (cyc / f.speed) * f.drift
                    + Math.sin(t * f.swayHz * 6.283 + f.swayOff) * f.swayAmp;
            let o;
            if (y < g.FADE_IN_END) o = Math.max(0, (y + g.LEAD) / (g.FADE_IN_END + g.LEAD));
            else if (y > g.FADE_OUT_START) o = Math.max(0, 1 - (y - g.FADE_OUT_START) / (g.FADE_OUT_END - g.FADE_OUT_START));
            else o = 1;
            f.el.style.transform = 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px)';
            f.el.style.opacity = (o * f.max).toFixed(3);
        }
        this._raf = requestAnimationFrame((ts2) => this._tick(ts2));
    }

    stop() {
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = null;
        this._t0 = null;
        this._flakes = null;
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }

    toggle() {
        if (this.container) this.stop(); else this.init();
    }
}

if (typeof window !== 'undefined') {
    window.SnowEffect = SnowEffect;
}
