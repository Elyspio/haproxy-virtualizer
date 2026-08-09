import { useMemo, useState } from "react";
import { Add, DeleteOutline, LockOutlined, TuneOutlined } from "@mui/icons-material";
import { Accordion, AccordionDetails, AccordionSummary, Autocomplete, Chip, MenuItem, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { ExpandMore } from "@mui/icons-material";
import type { HaproxyExtra, HaproxySchemaField, HaproxySchemaSectionName } from "@modules/config/config.types";
import { parseExtra, serializeExtra } from "@modules/config/config.utils";
import { useSchemaQuery } from "@/core/api/queries";

type AdvancedOptionsEditorProps = {
	/** Which Data Plane section the edited resource belongs to; picks the field catalogue. */
	section: HaproxySchemaSectionName;
	/** Shown next to the title so several editors on one screen stay distinguishable. */
	label: string;
	extra: HaproxyExtra;
	fields: HaproxySchemaField[];
	onChange: (extra: HaproxyExtra) => void;
	/** Prefix for the `data-testid` attributes the end-to-end tests target. */
	testId: string;
	/** Drawer layouts expose the fields immediately while the legacy panels keep the compact accordion. */
	inline?: boolean;
};

/**
 * Values the Data Plane API models as nested objects or arrays. They are round-tripped untouched — dropping them would
 * be the very configuration loss this passthrough exists to prevent — but editing them as text is not worth the
 * footgun, so they are shown read-only.
 */
function isComplex(value: unknown): boolean {
	return typeof value === "object" && value !== null;
}

function formatScalar(value: unknown): string {
	return typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : "";
}

function formatComplex(value: unknown): string {
	const serialized = JSON.stringify(value);
	return serialized.length > 60 ? `${serialized.slice(0, 57)}…` : serialized;
}

/**
 * Turns the text typed in the value box into the JSON type the field expects, so the API receives `5` rather than
 * `"5"`. Unparseable numbers are kept as text: the API answers with the field name, which beats silently dropping it.
 */
function coerce(field: HaproxySchemaField | undefined, raw: string): unknown {
	if (field?.type === "number") {
		const parsed = Number(raw);
		return raw.trim() !== "" && Number.isFinite(parsed) ? parsed : raw;
	}

	if (field?.type === "boolean") {
		return raw === "true";
	}

	return raw;
}

/**
 * The advanced fields of one configuration section, as advertised by the API.
 */
export function useSchemaFields(section: HaproxySchemaSectionName): HaproxySchemaField[] {
	const { data } = useSchemaQuery();
	return useMemo(() => data?.sections.find((item) => item.name === section)?.fields ?? [], [data, section]);
}

export function AdvancedOptionsEditor({ section, label, extra, fields, onChange, testId, inline = false }: Readonly<AdvancedOptionsEditorProps>) {
	const theme = useTheme();
	const [newFieldName, setNewFieldName] = useState<string | null>(null);

	const values = useMemo(() => parseExtra(extra), [extra]);
	const entries = useMemo(() => Object.entries(values).sort(([left], [right]) => left.localeCompare(right)), [values]);
	const fieldsByName = useMemo(() => new Map(fields.map((field) => [field.name, field])), [fields]);
	const availableFields = useMemo(() => fields.filter((field) => field.writable && !(field.name in values)), [fields, values]);

	const setValue = (name: string, value: unknown) => onChange(serializeExtra({ ...values, [name]: value }));

	const removeValue = (name: string) => {
		const { [name]: _removed, ...rest } = values;
		onChange(serializeExtra(rest));
	};

	return (
		<Accordion
			disableGutters
			elevation={0}
			defaultExpanded={inline}
			data-testid={testId}
			sx={{
				border: `1px solid ${theme.palette.divider}`,
				borderRadius: 2.5,
				"&::before": { display: "none" },
				backgroundColor: alpha(theme.palette.background.default, 0.24),
			}}
		>
			<AccordionSummary expandIcon={<ExpandMore fontSize="small" />}>
				<Stack direction="row" spacing={1} alignItems="center">
					<TuneOutlined fontSize="small" color="action" />
					<Typography variant="subtitle2">Advanced</Typography>
					<Typography variant="caption" color="text.secondary">
						{label}
					</Typography>
					{entries.length > 0 ? <Chip size="small" label={entries.length} /> : null}
				</Stack>
			</AccordionSummary>
			<AccordionDetails sx={inline ? { px: 1.25 } : undefined}>
				<Stack spacing={1.25}>
					<Typography variant="caption" color="text.secondary">
						Any HAProxy Data Plane {section} setting this editor does not model. Existing values are preserved even when they are not editable here.
					</Typography>

					{entries.map(([name, value]) => {
						const field = fieldsByName.get(name);
						const complex = isComplex(value);
						const readOnly = complex || field?.writable === false;

						return (
							<Stack
								key={name}
								data-testid={`${testId}-row-${name}`}
								direction={inline ? "column" : { xs: "column", md: "row" }}
								spacing={1.25}
								alignItems={inline ? "stretch" : { md: "center" }}
							>
								<TextField
									size="small"
									fullWidth={inline}
									label="Field"
									value={name}
									sx={{ minWidth: inline ? 0 : 220 }}
									slotProps={{ input: { readOnly: true } }}
								/>

								{readOnly ? (
									<Tooltip title={complex ? "Nested value, preserved as-is" : (field?.reason ?? "This field cannot be changed from the editor.")} arrow>
										<TextField
											size="small"
											fullWidth
											label={complex ? "Nested value" : "Locked"}
											value={complex ? formatComplex(value) : formatScalar(value)}
											slotProps={{
												input: { readOnly: true, startAdornment: complex ? undefined : <LockOutlined fontSize="small" color="disabled" sx={{ mr: 1 }} /> },
											}}
										/>
									</Tooltip>
								) : (
									<TextField
										size="small"
										fullWidth
										select={field?.type === "enum" || field?.type === "boolean"}
										type={field?.type === "number" ? "number" : "text"}
										label="Value"
										slotProps={{ htmlInput: { "data-testid": `${testId}-value-${name}` } }}
										value={formatScalar(value)}
										onChange={(event) => setValue(name, coerce(field, event.target.value))}
									>
										{field?.type === "boolean"
											? ["true", "false"].map((option) => (
													<MenuItem key={option} value={option}>
														{option}
													</MenuItem>
												))
											: (field?.enumValues ?? []).map((option) => (
													<MenuItem key={option} value={option}>
														{option}
													</MenuItem>
												))}
									</TextField>
								)}

								<Tooltip title={readOnly && !complex ? "Locked fields cannot be removed" : "Remove"} arrow>
									<span>
										<DeleteOutline
											fontSize="small"
											color={readOnly && !complex ? "disabled" : "error"}
											sx={{ cursor: readOnly && !complex ? "not-allowed" : "pointer" }}
											onClick={() => {
												if (readOnly && !complex) return;
												removeValue(name);
											}}
										/>
									</span>
								</Tooltip>
							</Stack>
						);
					})}

					<Stack direction={inline ? "column" : "row"} spacing={1.25} alignItems={inline ? "stretch" : "center"}>
						<Autocomplete
							size="small"
							sx={{ minWidth: inline ? 0 : 260, width: inline ? "100%" : undefined }}
							options={availableFields}
							getOptionLabel={(option) => option.name}
							value={availableFields.find((field) => field.name === newFieldName) ?? null}
							onChange={(_event, option) => setNewFieldName(option?.name ?? null)}
							renderOption={(props, option) => (
								<li {...props} key={option.name}>
									<Stack>
										<Typography variant="body2">{option.name}</Typography>
										<Typography variant="caption" color="text.secondary">
											{option.type === "enum" ? option.enumValues.join(" | ") : option.type}
										</Typography>
									</Stack>
								</li>
							)}
							renderInput={(params) => (
								<TextField {...params} label="Add a field" slotProps={{ htmlInput: { ...params.inputProps, "data-testid": `${testId}-field` } }} />
							)}
						/>
						<Chip
							data-testid={`${testId}-add`}
							icon={<Add fontSize="small" />}
							label="Add"
							sx={inline ? { alignSelf: "flex-start" } : undefined}
							variant="outlined"
							clickable
							disabled={!newFieldName}
							onClick={() => {
								if (!newFieldName) return;
								const field = fieldsByName.get(newFieldName);
								setValue(newFieldName, field?.type === "number" ? 0 : field?.type === "boolean" ? false : (field?.enumValues[0] ?? ""));
								setNewFieldName(null);
							}}
						/>
					</Stack>
				</Stack>
			</AccordionDetails>
		</Accordion>
	);
}
