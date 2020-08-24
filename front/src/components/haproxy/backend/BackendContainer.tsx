import React from 'react';
import {Accordion, AccordionDetails, AccordionSummary, Typography} from "@material-ui/core";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import {connect, ConnectedProps} from "react-redux";
import {RootState} from "../../../store/reducer";
import {Dispatch} from "redux";
import Backend from "./Backend";

const mapStateToProps = (state: RootState) => ({
    backends: state.haproxy.config?.backends
})

const mapDispatchToProps = (dispatch: Dispatch) => ({})

const connector = connect(mapStateToProps, mapDispatchToProps);
type ReduxTypes = ConnectedProps<typeof connector>;


function BackendContainer(props: ReduxTypes) {

    const backends = props.backends ? Object.entries(props.backends).map(([key, value]) => ({name: key, data: value})) : []


    return (
        <Accordion>
            <AccordionSummary
                expandIcon={<ExpandMoreIcon/>}
                aria-controls="panel1a-content"
                id="panel1a-header"
            >
                <Typography className={"title"}>Backends</Typography>
            </AccordionSummary>
            <AccordionDetails>
                {backends.map(b => <Backend data={b}/>)}
            </AccordionDetails>
        </Accordion>
    );
}

export default connector(BackendContainer);
