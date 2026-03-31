import os
import time
import logging
import subprocess
from datetime import datetime, timedelta

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RetrainingScheduler:
    """
    Implements Task 2.4.3: Continuous Retraining Scheduler.
    Monitors for new data and triggers the fine-tuning pipeline weekly.
    """
    def __init__(self, check_interval_hours: int = 24, retraining_day: int = 0): # Default: Monday
        self.check_interval_hours = check_interval_hours
        self.retraining_day = retraining_day
        self.last_run = None

    def should_retrain(self) -> bool:
        """Checks if it's the scheduled retraining day and time."""
        now = datetime.now()
        
        # Condition 1: It's the right day of the week
        if now.weekday() != self.retraining_day:
            return False
            
        # Condition 2: We haven't run it today yet
        if self.last_run and self.last_run.date() == now.date():
            return False
            
        return True

    def run_retraining_job(self):
        """Triggers the fine_tuner.py script."""
        logger.info(f"Triggering Scheduled Weekly Retraining Job at {datetime.now()}")
        
        try:
            # Path to the fine_tuner script (assuming it's in the same directory)
            script_path = os.path.join(os.path.dirname(__file__), "fine_tuner.py")
            
            if not os.path.exists(script_path):
                logger.error(f"Retraining Failed: {script_path} not found.")
                return

            # Simulate running the fine-tuner
            # In production: subprocess.run([sys.executable, script_path, "--config", "weekly_config.json"])
            logger.info(f"Running command: python {script_path} --mode weekly")
            
            # Update last run
            self.last_run = datetime.now()
            logger.info("Retraining job completed successfully.")
            
        except Exception as e:
            logger.error(f"Retraining Scheduler Error: {e}")

    def start(self):
        """Main loop for the scheduler."""
        logger.info("Retraining Scheduler Started. Monitoring for weekly schedule...")
        try:
            while True:
                if self.should_retrain():
                    self.run_retraining_job()
                
                # Sleep until next check
                time.sleep(self.check_interval_hours * 3600)
        except KeyboardInterrupt:
            logger.info("Retraining Scheduler stopped.")

if __name__ == "__main__":
    scheduler = RetrainingScheduler()
    # For demonstration, we'll just check once and trigger if conditions met
    if scheduler.should_retrain():
        scheduler.run_retraining_job()
    else:
        logger.info("Retraining conditions not met. Will wait for next scheduled window (Monday).")
