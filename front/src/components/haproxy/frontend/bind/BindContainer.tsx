import React from 'react';
import {Core} from "../../../../../../back/core/haproxy/types";
import {MapDispatchFrontend} from "../Frontend";
import {connect, ConnectedProps} from "react-redux";
import {Dispatch} from "redux";
import {RootState} from "../../../../store/reducer";
import Bind from "./Bind";
import Button from '@material-ui/core/Button';
import {Add} from "@material-ui/icons";

const mapStateToProps = (state: RootState) => ({})
const mapDispatchToProps = (dispatch: Dispatch) => ({})

const connector = connect(mapStateToProps, mapDispatchToProps);
type ReduxTypes = ConnectedProps<typeof connector>;


type Props = ReduxTypes & {
    update: MapDispatchFrontend["update"],
    data: Core.Bind[],
    frontendName: string
};

function BindContainer(props: Props) {
    const {update, data, frontendName} = props;

    return (
        <>
            {
                data.map((binding, index) => {
                    return <React.Fragment key={index}>
                        {index === 0
                            ? <Bind update={update} frontendName={frontendName} index={index} data={binding}
                                    header={<Button onClick={update.bind.create}>New binding <Add/></Button>}/>
                            : <Bind update={update} frontendName={frontendName} index={index} data={binding}/>
                        }
                    </React.Fragment>
                })
            }
        </>
    );
}

export default connector(BindContainer);
