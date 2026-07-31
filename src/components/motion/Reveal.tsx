/* eslint-disable react-refresh/only-export-components -- shadcn/ui pattern: cva variant object is exported alongside the component from the same file; splitting them would break the shadcn component contract */
import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

const spring = { type: "spring" as const, stiffness: 90, damping: 20, mass: 0.8 };

export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: spring },
};

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: { opacity: 0, y: 18 },
        visible: { opacity: 1, y: 0, transition: { ...spring, delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({
  children,
  className,
  gap = 0.08,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={{ visible: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Renders as a div by default. Pass as="li" inside a list so the markup stays
 * semantically valid (a <ul> may only contain <li> children).
 */
export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  const Component = as === "li" ? motion.li : motion.div;
  return (
    <Component className={className} variants={revealVariants}>
      {children}
    </Component>
  );
}
