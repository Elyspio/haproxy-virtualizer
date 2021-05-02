import React from 'react';
import {Haproxy} from "../../../../../../../back/src/controllers/haproxy/types";
import {MapDispatchFrontend} from "../Frontend";
import Bind from "./Bind";
import Button from '@material-ui/core/Button';
import {Add} from "@material-ui/icons";


type Props = {
    update: MapDispatchFrontend["update"],
    data: Haproxy.Bind[],
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

export default BindContainer;
