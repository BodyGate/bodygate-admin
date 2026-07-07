import TrainingSidebar from "../components/training/TrainingSidebar";
import styles from "../components/training/training-premium.module.css";

export default function TrainingLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.shell}><TrainingSidebar />{children}</div>;
}
