/**
 * Reusable scroll-animation primitives.
 *
 * Every primitive degrades gracefully when the user has
 * "prefers-reduced-motion" enabled: layout is preserved, motion is dropped.
 */

import React, {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    motion,
    useAnimationFrame,
    useInView,
    useMotionTemplate,
    useMotionValue,
    useReducedMotion,
    useScroll,
    useSpring,
    useTransform,
    useVelocity,
} from "framer-motion";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1];

/** Wrap a value into the [min, max) range — used for seamless marquees. */
function wrapValue(min, max, value) {
    const range = max - min;
    return ((((value - min) % range) + range) % range) + min;
}

/* ==========================================================================
   1. ScrollProgress — thin reading-progress bar pinned to the top
   ========================================================================== */

export function ScrollProgress({ className = "" }) {
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, {
        stiffness: 180,
        damping: 30,
        restDelta: 0.001,
    });

    return (
        <motion.div
            aria-hidden="true"
            style={{ scaleX }}
            className={`fixed left-0 top-0 z-[60] h-1 w-full origin-left bg-flame ${className}`}
        />
    );
}

/* ==========================================================================
   2. Reveal — slide + fade in when scrolled into view
   ========================================================================== */

const REVEAL_OFFSETS = {
    up: { x: 0, y: 34 },
    down: { x: 0, y: -34 },
    left: { x: 40, y: 0 },
    right: { x: -40, y: 0 },
    none: { x: 0, y: 0 },
};

export function Reveal({
    children,
    as: Tag = "div",
    from = "up",
    delay = 0,
    duration = 0.7,
    amount = 0.25,
    once = true,
    className = "",
    ...rest
}) {
    const reduce = useReducedMotion();
    const MotionTag = motion[Tag] ?? motion.div;
    const offset = REVEAL_OFFSETS[from] ?? REVEAL_OFFSETS.up;

    if (reduce) {
        return (
            <Tag className={className} {...rest}>
                {children}
            </Tag>
        );
    }

    return (
        <MotionTag
            className={className}
            initial={{ opacity: 0, x: offset.x, y: offset.y }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once, amount }}
            transition={{ duration, delay, ease: EASE_OUT_EXPO }}
            {...rest}
        >
            {children}
        </MotionTag>
    );
}

/* ==========================================================================
   3. SplitWords — per-word mask reveal for headlines
   ========================================================================== */

export function SplitWords({
    text,
    className = "",
    wordClassName = "",
    delay = 0,
    stagger = 0.055,
    duration = 0.85,
    as: Tag = "span",
    once = true,
}) {
    const reduce = useReducedMotion();
    const words = useMemo(() => String(text).split(" "), [text]);
    const MotionTag = motion[Tag] ?? motion.span;

    if (reduce) {
        return <Tag className={className}>{text}</Tag>;
    }

    // The viewport observer MUST live on the unclipped container, not on the
    // words themselves. The words start translated outside their own
    // overflow-hidden mask, and IntersectionObserver clips a target's rect by
    // its ancestor clipping containers — so an observer on a word would report
    // a ratio of 0 forever and the reveal would never fire.
    const container = {
        hidden: {},
        visible: {
            transition: { staggerChildren: stagger, delayChildren: delay },
        },
    };

    const wordVariants = {
        hidden: { y: "110%", rotate: 3 },
        visible: {
            y: "0%",
            rotate: 0,
            transition: { duration, ease: EASE_OUT_EXPO },
        },
    };

    return (
        <MotionTag
            className={className}
            variants={container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once, amount: 0.15 }}
        >
            {words.map((word, i) => (
                // Outer span is the mask; inner span slides up out of it.
                // Padding gives descenders (g, y, p) room to paint, since display
                // headings use tighter leading than the glyphs actually occupy;
                // the matching negative margin keeps layout height unchanged.
                <span
                    key={`${word}-${i}`}
                    className="inline-block overflow-hidden align-bottom"
                    style={{ paddingBottom: "0.16em", marginBottom: "-0.16em" }}
                >
                    <motion.span
                        className={`inline-block ${wordClassName}`}
                        variants={wordVariants}
                    >
                        {word}
                        {i < words.length - 1 ? "\u00A0" : ""}
                    </motion.span>
                </span>
            ))}
        </MotionTag>
    );
}

/* ==========================================================================
   4. Parallax — element drifts at a different rate than the page
   ========================================================================== */

export function Parallax({
    children,
    distance = 70,
    className = "",
    ...rest
}) {
    const ref = useRef(null);
    const reduce = useReducedMotion();
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"],
    });
    const yRaw = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
    const y = useSpring(yRaw, { stiffness: 110, damping: 26, mass: 0.35 });

    return (
        <motion.div
            ref={ref}
            className={className}
            style={reduce ? undefined : { y }}
            {...rest}
        >
            {children}
        </motion.div>
    );
}

/* ==========================================================================
   5. VelocityMarquee — ticker that speeds up and skews with scroll velocity
   ========================================================================== */

export function VelocityMarquee({
    children,
    baseVelocity = 3,
    className = "",
    itemClassName = "",
}) {
    const reduce = useReducedMotion();
    const baseX = useMotionValue(0);
    const directionRef = useRef(1);

    const { scrollY } = useScroll();
    const scrollVelocity = useVelocity(scrollY);
    const smoothVelocity = useSpring(scrollVelocity, {
        damping: 50,
        stiffness: 400,
    });
    const velocityFactor = useTransform(smoothVelocity, [0, 1200], [0, 4], {
        clamp: false,
    });
    const skewRaw = useTransform(smoothVelocity, [-2000, 0, 2000], [-6, 0, 6], {
        clamp: true,
    });
    const skew = useSpring(skewRaw, { stiffness: 200, damping: 40 });

    const x = useTransform(baseX, (v) => `${wrapValue(-50, 0, v)}%`);

    useAnimationFrame((_t, delta) => {
        if (reduce) return;
        let moveBy = directionRef.current * baseVelocity * (delta / 1000);

        const factor = velocityFactor.get();
        if (factor < 0) directionRef.current = -1;
        else if (factor > 0) directionRef.current = 1;

        moveBy += directionRef.current * moveBy * Math.abs(factor);
        baseX.set(baseX.get() + moveBy);
    });

    // Duplicated twice so the -50% wrap is seamless.
    const content = (
        <>
            <span className={itemClassName}>{children}</span>
            <span className={itemClassName} aria-hidden="true">
                {children}
            </span>
        </>
    );

    if (reduce) {
        return (
            <div className={`overflow-hidden ${className}`}>
                <div className="flex whitespace-nowrap">{content}</div>
            </div>
        );
    }

    return (
        <motion.div
            className={`overflow-hidden ${className}`}
            style={{ skewY: skew }}
        >
            <motion.div className="flex flex-nowrap whitespace-nowrap" style={{ x }}>
                {content}
            </motion.div>
        </motion.div>
    );
}

/* ==========================================================================
   6. StickyStack — cards that pin and stack on top of each other
   ========================================================================== */

export function StickyStack({ children, className = "", topOffset = 120, step = 16 }) {
    const items = React.Children.toArray(children);

    return (
        <div className={className}>
            {items.map((child, i) => (
                <StackItem
                    key={i}
                    index={i}
                    total={items.length}
                    topOffset={topOffset}
                    step={step}
                >
                    {child}
                </StackItem>
            ))}
        </div>
    );
}

function StackItem({ children, index, total, topOffset, step }) {
    const ref = useRef(null);
    const reduce = useReducedMotion();
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start 25%", "end 25%"],
    });

    const isLast = index === total - 1;
    // Earlier cards shrink slightly as later ones slide over them.
    const scale = useTransform(scrollYProgress, [0, 1], [1, isLast ? 1 : 0.9]);
    const opacity = useTransform(scrollYProgress, [0, 1], [1, isLast ? 1 : 0.4]);

    if (reduce) {
        return (
            <div ref={ref} className="mb-6">
                {children}
            </div>
        );
    }

    return (
        <div
            ref={ref}
            className="sticky mb-8"
            style={{ top: topOffset + index * step }}
        >
            <motion.div style={{ scale, opacity, transformOrigin: "center top" }}>
                {children}
            </motion.div>
        </div>
    );
}

/* ==========================================================================
   7. HorizontalScroll — pinned section that pans sideways as you scroll down
   ========================================================================== */

/**
 * `speed` controls how far the track pans per pixel scrolled. At 1 the section is
 * as tall as the track is wide (plus one viewport to pin against), which can cost
 * several screens of scrolling. Above 1 the track moves proportionally faster, so
 * the same content needs less vertical scroll to get through.
 */
export function HorizontalScroll({
    children,
    backdrop,
    className = "",
    trackClassName = "",
    speed = 1,
}) {
    const sectionRef = useRef(null);
    const trackRef = useRef(null);
    const reduce = useReducedMotion();

    const [metrics, setMetrics] = useState({ distance: 0, viewportH: 0 });

    useLayoutEffect(() => {
        const measure = () => {
            const track = trackRef.current;
            if (!track) return;
            const distance = Math.max(0, track.scrollWidth - window.innerWidth);
            setMetrics({ distance, viewportH: window.innerHeight });
        };

        measure();
        window.addEventListener("resize", measure);

        const observer = new ResizeObserver(measure);
        if (trackRef.current) observer.observe(trackRef.current);

        return () => {
            window.removeEventListener("resize", measure);
            observer.disconnect();
        };
    }, [children]);

    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start start", "end end"],
    });
    const xRaw = useTransform(scrollYProgress, [0, 1], [0, -metrics.distance]);
    const x = useSpring(xRaw, { stiffness: 130, damping: 28, mass: 0.4 });

    // Fall back to a normal swipeable row when motion is reduced.
    if (reduce) {
        return (
            <section className={`relative ${className}`}>
                {backdrop ? (
                    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
                        {backdrop}
                    </div>
                ) : null}
                <div
                    ref={trackRef}
                    className={`relative z-10 flex gap-6 overflow-x-auto px-6 pb-4 custom-scrollbar ${trackClassName}`}
                >
                    {children}
                </div>
            </section>
        );
    }

    // Scroll budget needed to pan the whole track, shortened by `speed`.
    const scrollLength = metrics.distance / Math.max(speed, 0.1);

    return (
        <section
            ref={sectionRef}
            className={className}
            style={{ height: scrollLength + metrics.viewportH }}
        >
            <div className="sticky top-0 flex h-screen items-center overflow-hidden">
                {/* Decoration lives inside the pinned viewport so it stays aligned
                    with the cards instead of scrolling away with the section. */}
                {backdrop ? (
                    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
                        {backdrop}
                    </div>
                ) : null}

                <motion.div
                    ref={trackRef}
                    style={{ x }}
                    className={`relative z-10 flex flex-nowrap items-center gap-6 px-6 will-change-transform ${trackClassName}`}
                >
                    {children}
                </motion.div>
            </div>
        </section>
    );
}

/* ==========================================================================
   8. Magnetic — element leans toward the cursor
   ========================================================================== */

export function Magnetic({ children, strength = 0.28, className = "", ...rest }) {
    const ref = useRef(null);
    const reduce = useReducedMotion();
    const mx = useMotionValue(0);
    const my = useMotionValue(0);
    const x = useSpring(mx, { stiffness: 260, damping: 18, mass: 0.4 });
    const y = useSpring(my, { stiffness: 260, damping: 18, mass: 0.4 });

    const handleMove = (event) => {
        const node = ref.current;
        if (!node || reduce) return;
        const rect = node.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        mx.set((event.clientX - cx) * strength);
        my.set((event.clientY - cy) * strength);
    };

    const reset = () => {
        mx.set(0);
        my.set(0);
    };

    return (
        <motion.div
            ref={ref}
            className={className}
            style={reduce ? undefined : { x, y }}
            onPointerMove={handleMove}
            onPointerLeave={reset}
            {...rest}
        >
            {children}
        </motion.div>
    );
}

/* ==========================================================================
   9. TiltCard — subtle 3D tilt following the cursor
   ========================================================================== */

export function TiltCard({ children, max = 8, className = "", ...rest }) {
    const ref = useRef(null);
    const reduce = useReducedMotion();
    const rx = useMotionValue(0);
    const ry = useMotionValue(0);
    const springX = useSpring(rx, { stiffness: 220, damping: 20 });
    const springY = useSpring(ry, { stiffness: 220, damping: 20 });
    const transform = useMotionTemplate`perspective(900px) rotateX(${springX}deg) rotateY(${springY}deg)`;

    const handleMove = (event) => {
        const node = ref.current;
        if (!node || reduce) return;
        const rect = node.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;
        rx.set(-py * max * 2);
        ry.set(px * max * 2);
    };

    const reset = () => {
        rx.set(0);
        ry.set(0);
    };

    return (
        <motion.div
            ref={ref}
            className={className}
            style={reduce ? undefined : { transform }}
            onPointerMove={handleMove}
            onPointerLeave={reset}
            {...rest}
        >
            {children}
        </motion.div>
    );
}

/* ==========================================================================
   10. CountUp — number ticks up the first time it enters the viewport
   ========================================================================== */

export function CountUp({
    to,
    from = 0,
    duration = 1.6,
    suffix = "",
    prefix = "",
    decimals = 0,
    className = "",
}) {
    const ref = useRef(null);
    const reduce = useReducedMotion();
    const inView = useInView(ref, { once: true, amount: 0.6 });
    const [value, setValue] = useState(from);

    useEffect(() => {
        if (!inView) return;

        // Jump straight to the final value, but on the next frame rather than
        // synchronously, to avoid a cascading render inside the effect.
        if (reduce) {
            const id = requestAnimationFrame(() => setValue(to));
            return () => cancelAnimationFrame(id);
        }

        let frame = 0;
        const start = performance.now();

        const tick = (now) => {
            const elapsed = (now - start) / 1000;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutExpo
            const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            setValue(from + (to - from) * eased);
            if (progress < 1) frame = requestAnimationFrame(tick);
        };

        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [inView, to, from, duration, reduce]);

    return (
        <span ref={ref} className={className}>
            {prefix}
            {value.toFixed(decimals)}
            {suffix}
        </span>
    );
}

/* ==========================================================================
   11. ScrollScale — scrubs scale/rotate/opacity across the viewport
   ========================================================================== */

export function ScrollScale({
    children,
    fromScale = 0.86,
    toScale = 1,
    fromRotate = -3,
    toRotate = 0,
    className = "",
}) {
    const ref = useRef(null);
    const reduce = useReducedMotion();
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start 0.9", "end 0.55"],
    });

    const scale = useTransform(scrollYProgress, [0, 1], [fromScale, toScale]);
    const rotate = useTransform(scrollYProgress, [0, 1], [fromRotate, toRotate]);
    const smoothScale = useSpring(scale, { stiffness: 120, damping: 26 });
    const smoothRotate = useSpring(rotate, { stiffness: 120, damping: 26 });

    return (
        <div ref={ref} className={className}>
            <motion.div
                style={reduce ? undefined : { scale: smoothScale, rotate: smoothRotate }}
            >
                {children}
            </motion.div>
        </div>
    );
}

/* ==========================================================================
   NOTE: a clip-path "curtain wipe" primitive used to live here. It was removed
   on purpose. Because it renders content at clip-path: inset(0 100% 0 0), the
   content is invisible until its whileInView observer fires — so any failure to
   trigger leaves real content permanently stranded (which is exactly what
   happened to the syllabus card). Reveal / ScrollScale are safe by comparison:
   they only animate opacity and transform, so content stays visible even if the
   animation never runs. Prefer those for anything content-bearing.
   ========================================================================== */
