import React, { useState } from 'react';
import styles from "../../styles/AnimatedLoginForm.module.css";
import { Box, TextField, Button, Typography, IconButton, InputAdornment, Link } from "@mui/material";
import { GoEye, GoEyeClosed } from "react-icons/go";
import { useFormik } from 'formik';
import * as yup from 'yup';

const AnimatedRegisterForm = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const validationSchema = yup.object({
    name: yup.string().required('Name is required'),
    surname: yup.string().required('Surname is required'),
    phoneNumber: yup.string().required('Phone number is required'),
    email: yup.string().email('Invalid email format').required('Email is required'),
    password: yup.string().required('Password is required'),
    confirmPassword: yup.string()
      .oneOf([yup.ref('password'), null], 'Passwords must match')
      .required('Confirm Password is required')
  });

  const formik = useFormik({
    initialValues: {
      name: '',
      surname: '',
      phoneNumber: '',
      email: '',
      password: '',
      confirmPassword: ''
    },
    validationSchema: validationSchema,
    onSubmit: (values, { resetForm }) => {
      setSubmitting(true);
      // Handle form submission
      // console.log("🚀 ~ Register ~ values:", values)

      resetForm();
      setSubmitting(false);
    },
  });

  return (
    <div className={styles.box}>
      <span className={styles.borderLine}></span>
      <form className={styles.form} onSubmit={formik.handleSubmit}>
        <h2 className={styles.heading}>Register</h2>
        <div className={styles.inputBox}>
          <TextField
            label="Name"
            variant="outlined"
            fullWidth
            margin="normal"
            name="name"
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.name && Boolean(formik.errors.name)}
            helperText={formik.touched.name && formik.errors.name}
          />
        </div>
        <div className={styles.inputBox}>
          <TextField
            label="Surname"
            variant="outlined"
            fullWidth
            margin="normal"
            name="surname"
            value={formik.values.surname}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.surname && Boolean(formik.errors.surname)}
            helperText={formik.touched.surname && formik.errors.surname}
          />
        </div>
        <div className={styles.inputBox}>
          <TextField
            label="Phone Number"
            variant="outlined"
            fullWidth
            margin="normal"
            name="phoneNumber"
            value={formik.values.phoneNumber}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.phoneNumber && Boolean(formik.errors.phoneNumber)}
            helperText={formik.touched.phoneNumber && formik.errors.phoneNumber}
          />
        </div>
        <div className={styles.inputBox}>
          <TextField
            label="Email"
            variant="outlined"
            fullWidth
            margin="normal"
            name="email"
            value={formik.values.email}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.email && Boolean(formik.errors.email)}
            helperText={formik.touched.email && formik.errors.email}
          />
        </div>
        <div className={styles.inputBox}>
          <TextField
            label="Password"
            type={showPassword ? "text" : "password"}
            variant="outlined"
            fullWidth
            margin="normal"
            name="password"
            value={formik.values.password}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.password && Boolean(formik.errors.password)}
            helperText={formik.touched.password && formik.errors.password}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={handleClickShowPassword}
                    edge="end"
                  >
                    {showPassword ? <GoEyeClosed /> : <GoEye />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        </div>
        <div className={styles.inputBox}>
          <TextField
            label="Confirm Password"
            type={showPassword ? "text" : "password"}
            variant="outlined"
            fullWidth
            margin="normal"
            name="confirmPassword"
            value={formik.values.confirmPassword}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.confirmPassword && Boolean(formik.errors.confirmPassword)}
            helperText={formik.touched.confirmPassword && formik.errors.confirmPassword}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={handleClickShowPassword}
                    edge="end"
                  >
                    {showPassword ? <GoEyeClosed /> : <GoEye />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        </div>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          className={styles.submitButton}
          disabled={submitting}
        >
          Register
        </Button>
        <Typography variant="body2" align="center" className={styles.links}>
          Already have an account? <Link href="/Login">Login here</Link>
        </Typography>
      </form>
    </div>
  );
};

export default AnimatedRegisterForm;