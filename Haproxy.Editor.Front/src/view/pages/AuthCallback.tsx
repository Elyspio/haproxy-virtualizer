import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { alpha, keyframes } from "@mui/material/styles";
import { routes } from "@/config/view.config";
import { useAuth } from "@/view/context/auth.context";

const fadeIn = keyframes`
	from { opacity: 0; transform: scale(0.96); }
	to { opacity: 1; transform: scale(1); }
`;

export const AuthCallback = () => {
	const navigate = useNavigate();
	const { completeSigninCallback, signIn } = useAuth();
	const [failed, setFailed] = useState(false);
	const callbackCompletion = useRef<Promise<void> | null>(null);
	useEffect(() => {
		let active = true;
		callbackCompletion.current ??= Promise.resolve().then(completeSigninCallback);
		void callbackCompletion.current
			.then(() => {
				if (active) void navigate(routes.dashboard.summary.path, { replace: true });
			})
			.catch(() => {
				if (active) setFailed(true);
			});

		return () => {
			active = false;
		};
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
				{failed ? null : <CircularProgress size={40} thickness={3} />}
				<Stack alignItems="center" spacing={0.75}>
					<Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: "0.06em" }}>
						{failed ? "Authentication failed" : "Authenticating"}
					</Typography>
					<Typography variant="body2" color="text.secondary">
						{failed ? "The sign-in response could not be completed." : "Establishing secure session..."}
					</Typography>
				</Stack>
				{failed ? (
					<Button variant="contained" onClick={signIn}>
						Try signing in again
					</Button>
				) : null}
			</Stack>
		</Box>
	);
};
