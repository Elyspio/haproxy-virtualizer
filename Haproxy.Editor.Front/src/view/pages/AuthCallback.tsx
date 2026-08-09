import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { alpha, keyframes } from "@mui/material/styles";
import { routes } from "@/config/view.config";
import { useAuth } from "@/view/context/auth.context";

const fadeIn = keyframes`
	from { opacity: 0; transform: scale(0.96); }
	to { opacity: 1; transform: scale(1); }
`;

export const AuthCallback = () => {
	const navigate = useNavigate();
	const { completeSigninCallback } = useAuth();
	useEffect(() => {
		void completeSigninCallback().then(() => navigate(routes.dashboard.summary.path, { replace: true }));
	}, [completeSigninCallback, navigate]);

	return (
		<Box
			sx={{
				position: "fixed",
				inset: 0,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: (theme) =>
					theme.palette.mode === "dark"
						? `radial-gradient(ellipse 50% 40% at 50% 45%, ${alpha("#1a3a6e", 0.4)}, transparent 70%), #060c18`
						: `radial-gradient(ellipse 50% 40% at 50% 45%, ${alpha("#2f6fed", 0.1)}, transparent 70%), #e8edf5`,
			}}
		>
			<Stack alignItems="center" spacing={3} sx={{ animation: `${fadeIn} 0.5s ease-out both` }}>
				<CircularProgress size={40} thickness={3} />
				<Stack alignItems="center" spacing={0.75}>
					<Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: "0.06em" }}>
						Authenticating
					</Typography>
					<Typography variant="body2" color="text.secondary">
						Establishing secure session...
					</Typography>
				</Stack>
			</Stack>
		</Box>
	);
};
