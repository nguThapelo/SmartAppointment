import React from "react";
import styles from "../../styles/AnimatedLoginForm.module.css";

const AnimatedLoginForm = () => {
  return (
    <div className={styles.box}>
      <span className={styles.borderLine}></span>
      <form className={styles.form} action="">
        <h2 className={styles.heading}>Sign in</h2>
        <div className={styles.inputBox}>
          <input className={styles.input} type="text" required />
          <span className={styles.label}>Username</span>
          <i className={styles.line}></i>
        </div>
        <div className={styles.inputBox}>
          <input className={styles.input} type="password" required />
          <span className={styles.label}>Password</span>
          <i className={styles.line}></i>
        </div>
        <div className={styles.links}>
          <a className={styles.link} href="#">Forgot Password</a>
          <a className={styles.link} href="#">Signup</a>
        </div>
        <input className={styles.submitButton} type="submit" value="Login" />
      </form>
    </div>
  );
};

export default AnimatedLoginForm;