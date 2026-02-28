import { Box, Divider, Typography } from "@mui/material";
import React from "react";
import { useRouter } from 'next/router';

const PageHeader = ({ routeName }) => {
  const router = useRouter();
  const currentRouteName = routeName || router.pathname.split('/').pop();
  const routeParts = currentRouteName.split(" ");

  return (
    <Box sx={{ position: "relative" }}>
      {routeParts.length === 1 ? (
        <Divider>
          <Typography
            variant="h4"
            sx={{ color: "#1f2c47", textAlign: "center" }}
          >
            {routeParts[0]}
          </Typography>
        </Divider>
      ) : (
        <>
          <Typography
            variant="h4"
            sx={{ color: "#1f2c47", textAlign: "center" }}
          >
            {routeParts[0]}
          </Typography>
          <Divider>
            <Typography variant="subtitle1" sx={{ color: "#1f2c47" }}>
              {routeParts.slice(1).join(" ")}
            </Typography>
          </Divider>
        </>
      )}
    </Box>
  );
};

export default PageHeader;