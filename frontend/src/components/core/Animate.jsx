// src/components/core/Animate.jsx
// Lightweight drop-in replacement for framer-motion's <motion.div> and <AnimatePresence>.
// Uses pure CSS animations via Tailwind keyframes — zero JS runtime.
//
// Usage:
//   <Animate animation="fade-in" delay={200} className="...">...</Animate>
//   <Animate show={isOpen} animation="scale-in" unmount>...</Animate>  (replaces AnimatePresence)
//   <AnimateOnView animation="slide-up">...</AnimateOnView>  (replaces useInView/whileInView)

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ---------- animation name → tailwind class mapping ----------
const ANIMATION_MAP = {
  'fade-in':       'animate-motion-fade-in',
  'fade-out':      'animate-motion-fade-out',
  'slide-up':      'animate-motion-slide-up',
  'slide-up-sm':   'animate-motion-slide-up-sm',
  'slide-down':    'animate-motion-slide-down',
  'slide-left':    'animate-motion-slide-left',
  'slide-right':   'animate-motion-slide-right',
  'scale-in':      'animate-motion-scale-in',
  'scale-in-sm':   'animate-motion-scale-in-sm',
  'pop':           'animate-motion-pop',
  'height-in':     'animate-motion-height-in',
  'width-in':      'animate-motion-width-in',
  'none':          '',
};

/**
 * <Animate> — replaces <motion.div initial/animate/exit> and <AnimatePresence>
 *
 * Props:
 *  - animation:  key from ANIMATION_MAP (default 'fade-in')
 *  - delay:      ms delay (applied via inline style)
 *  - duration:   override duration e.g. '0.5s'
 *  - show:       boolean to toggle mount/unmount (replaces AnimatePresence)
 *  - unmount:    if true, removes DOM node after exit animation
 *  - as:         element tag, default 'div'
 *  - className:  extra classes
 *  - stagger:    ms stagger for children (use with index prop)
 *  - index:      child index for stagger calculation
 */
const Animate = React.forwardRef(({
  animation = 'fade-in',
  delay = 0,
  duration,
  show,
  unmount = false,
  as: Tag = 'div',
  className = '',
  style = {},
  stagger = 0,
  index = 0,
  children,
  ...rest
}, ref) => {
  // If `show` prop is not provided, always render (simple appear animation)
  const controlled = show !== undefined;
  const [mounted, setMounted] = useState(controlled ? show : true);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!controlled) return;
    if (show) {
      setMounted(true);
      setAnimating(false);
    } else {
      // Start exit animation, unmount after it ends
      setAnimating(true);
      const timer = setTimeout(() => {
        if (unmount) setMounted(false);
        setAnimating(false);
      }, 300); // match longest animation duration
      return () => clearTimeout(timer);
    }
  }, [show, controlled, unmount]);

  if (controlled && !mounted) return null;

  const isExiting = controlled && !show && animating;
  const animClass = isExiting
    ? 'animate-motion-fade-out'
    : ANIMATION_MAP[animation] || ANIMATION_MAP['fade-in'];

  const totalDelay = delay + (stagger * index);

  const mergedStyle = {
    ...style,
    ...(totalDelay > 0 ? { animationDelay: `${totalDelay}ms` } : {}),
    ...(duration ? { animationDuration: duration } : {}),
    ...(totalDelay > 0 ? { opacity: 0 } : {}), // hidden until delay fires
  };

  return (
    <Tag
      ref={ref}
      className={`${animClass} ${className}`}
      style={mergedStyle}
      {...rest}
    >
      {children}
    </Tag>
  );
});

Animate.displayName = 'Animate';

/**
 * <AnimateOnView> — replaces framer-motion's whileInView / useInView
 * Uses IntersectionObserver.  Triggers animation once when element scrolls into view.
 */
export function AnimateOnView({
  animation = 'slide-up',
  threshold = 0.1,
  once = true,
  delay = 0,
  duration,
  as: Tag = 'div',
  className = '',
  style = {},
  children,
  ...rest
}) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  const handleIntersection = useCallback(([entry]) => {
    if (entry.isIntersecting) {
      setIsVisible(true);
    } else if (!once) {
      setIsVisible(false);
    }
  }, [once]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleIntersection, {
      threshold,
      rootMargin: '0px 0px -40px 0px', // trigger slightly before fully in view
    });
    observer.observe(el);
    return () => observer.unobserve(el);
  }, [handleIntersection, threshold]);

  const animClass = isVisible
    ? (ANIMATION_MAP[animation] || ANIMATION_MAP['slide-up'])
    : 'opacity-0';

  const mergedStyle = {
    ...style,
    ...(delay > 0 && isVisible ? { animationDelay: `${delay}ms` } : {}),
    ...(duration && isVisible ? { animationDuration: duration } : {}),
  };

  return (
    <Tag
      ref={ref}
      className={`${animClass} ${className}`}
      style={mergedStyle}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default Animate;
