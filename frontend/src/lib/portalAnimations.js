export const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
  exit:    { opacity: 0, y: -10, transition: { duration: 0.2 } },
};

export const containerVariants = {
  initial:  {},
  animate:  { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

export const cardVariants = {
  initial: { opacity: 0, y: 24, scale: 0.97 },
  animate: { opacity: 1, y: 0,  scale: 1,   transition: { duration: 0.38, ease: [0.4, 0, 0.2, 1] } },
};

export const itemVariants = {
  initial: { opacity: 0, x: -14 },
  animate: { opacity: 1, x: 0,  transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
};

export const tapScale = { whileTap: { scale: 0.96 }, whileHover: { scale: 1.02 } };
