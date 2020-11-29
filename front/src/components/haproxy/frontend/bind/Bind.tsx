import React from 'react';
import {Haproxy} from "../../../../../../back/src/controllers/haproxy/types";
import {Grid, IconButton, TextField} from "@material-ui/core";
import {Autocomplete} from "@material-ui/lab";
import {MapDispatchFrontend} from "../Frontend";
import {connect, ConnectedProps} from "react-redux";
import {Dispatch} from "redux";
import {RootState} from "../../../../store/reducer";
import CloseIcon from "@material-ui/icons/Close";
import "./Bind.scss"

const mapStateToProps = (state: RootState) => ({frontends: state.haproxy.config.frontends})

const mapDispatchToProps = (dispatch: Dispatch) => ({})

const connector = connect(mapStateToProps, mapDispatchToProps);
type ReduxTypes = ConnectedProps<typeof connector>;


type Props = ReduxTypes & {
    index: number
    update: MapDispatchFrontend["update"],
    data: Haproxy.Bind,
    header?: JSX.Element,
    frontendName: string
};

function Bind(props: Props) {
    const {index, header, frontends, frontendName, update, data: bind} = props;

    // const ports = React.useMemo(() => [...new Set(...Object.values(frontends).map(f => f.bind.map(b => b.port.toString())).flat(), "80", "443")] as string[], [bind.port])
    // const options = React.useMemo(() => Object.values(frontends).map(f => f.bind.map(b => b.ssl)).flat().filter(x => x) as string[], [frontends])
    const ports = Object.values(frontends).map(f => f.bind.map(b => b.port.toString())).flat() as string[];
    const options = Object.values(frontends).map(f => f.bind.map(b => b.ssl)).flat().filter(x => x) as string[];

    console.log(ports, options)


    return (
        <>
            <Grid item xs={3}>
                {header}
            </Grid>

            <Grid item xs={9}>
                <div className={"field"}>
                    <TextField
                        className={"host"}
                        id={`front-${frontendName}-host-${index}`}
                        label="Host"
                        value={bind.host}
                        onChange={e => update.bind.host(index, e.target.value)}/>

                    <Autocomplete
                        className={"port"}
                        options={ports}
                        value={(bind.port || 0).toString()}
                        freeSolo={true}
                        autoComplete={true}
                        onInputChange={(event, value) => props.update.bind.port(index, Number.parseInt(value))}
                        renderInput={(params) => <TextField {...params} label="Port" variant="standard"/>}
                    />

                    <Autocomplete
                        className={"ssl-cert"}

                        options={[...new Set(options)]}
                        value={bind.ssl || ""}
                        freeSolo={true}
                        autoComplete={true}
                        onInputChange={(event, value) => props.update.bind.ssl(index, value)}
                        renderInput={(params) => <TextField {...params} label="SSL certificate Path" variant="standard"/>}
                    />

                    <IconButton className={"remove-btn"} onClick={() => props.update.bind.remove(index)}>
                        <CloseIcon fontSize={"small"}/>
                    </IconButton>
                </div>
            </Grid>
        </>
    );
}

export default connector(Bind);
