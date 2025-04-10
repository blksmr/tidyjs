// Misc
import {
    format,
    parseISO
}                           from 'date-fns';
import cn                   from 'classnames';
import { FontAwesomeIcon }  from '@fortawesome/react-fontawesome';
import {
    map,
    filter,
    orderBy
}                           from 'lodash';
import type { FC }          from 'react';
// DS
import {
    YpElement,
    YpFormModal,
    YpTypography,
    YpSkeletonList,
    useYpWrapperContext,
    useToastContext
} from 'ds';
// @app/dossier
import BulletinStatutEnum                   from '@app/dossier/models/enums/bulletin/BulletinStatut';
import BulletinTypeEnum                     from '@app/dossier/models/enums/BulletinType';
import { useDossierContext }                from '@app/dossier/providers/contexts/DossierContextProvider';
import { getValorisationByPropertyKey }     from '@app/dossier/utils/fiche';
import BulletinAnnuleIcon                   from '@app/dossier/utils/bulletin/bulletin-annule.svg?react';
import BulletinAnnulationIcon               from '@app/dossier/utils/bulletin/bulletin-annulation.svg?react';
import BulletinRemplacementIcon             from '@app/dossier/utils/bulletin/bulletin-remplacement.svg?react';
import BulletinComplementaireIcon           from '@app/dossier/utils/bulletin/bulletin-complementaire.svg?react';
import type BulletinChronologiqueModel      from '@app/dossier/models/BulletinChronologiqueModel';
import type BulletinAnnulationFormModel     from '@app/dossier/models/bulletin/BulletinAnnulationFormModel';
import type BulletinPeriodeModel            from '@app/dossier/models/BulletinPeriodeModel';
import type HistorisationModel              from '@app/dossier/models/fiches/HistorisationModel';
import type { TBulletinsActions }           from '@app/dossier/providers/bulletins/BulletinChronoSearchProvider';
// @app/notification
import { useClientNotification } from '@app/notification/ClientNotificationProvider';
// @core
import type {
    TDataProviderReturn,
    TFormProviderReturn,
    WsDataModel
} from '@core/models/ProviderModel';
// @library
import FormFieldComponent       from '@library/form/components/FormFieldComponent';
import FormComponent            from '@library/form/components/FormComponent';
import FormContextProvider      from '@library/form/providers/FormProvider';
import { formatLeadingZeros }   from '@library/utils/number';
import type FormFieldModel      from '@library/form/models/FormFieldModel';
// yutils
import {
    conjugate,
    getTextPreview
} from 'yutils/text';

type TProps = {
    isOpen: boolean;
    toggleModal: () => void;
    contrat?: HistorisationModel;
    periode: BulletinPeriodeModel;
    individu?: HistorisationModel;
    bulletinsChronoList?: TDataProviderReturn<BulletinChronologiqueModel[]>;
    bulletinsListToAnnule?: TDataProviderReturn<BulletinChronologiqueModel[]>;
    bulletinAnnulationForm: TFormProviderReturn<BulletinAnnulationFormModel, TBulletinsActions>
}

const BulletinAnnulationFormComponent: FC<TProps> = (props) => {

    // Variables
    const {
        isOpen,
        periode,
        contrat,
        individu,
        toggleModal,
        bulletinsChronoList,
        bulletinsListToAnnule,
        bulletinAnnulationForm
    } = props;

    const {
        form,
        definition
    } = bulletinAnnulationForm;

    // Contexts
    const wrapperContext = useYpWrapperContext();
    const dossierContext = useDossierContext();
    const toastContext = useToastContext();
    const notification = useClientNotification();

    const bulletinsIds = map(bulletinsListToAnnule?.data, (bulletin) => bulletin.id);

    const filteredBulletinsToAnnule = filter(bulletinsListToAnnule?.data, (bulletin) =>
        bulletin.statut === BulletinStatutEnum.value('GenerationTerminee')
    || bulletin.statut === BulletinStatutEnum.value('Paye')
    || bulletin.statut === BulletinStatutEnum.value('Valide')
    || bulletin.statut === BulletinStatutEnum.value('Cloture')
    );

    // Getters
    const getIndividuLibelle = (): string => {
        const indPrenom = getValorisationByPropertyKey(individu?.valorisations, 'indPrenom');
        const indNomUsage = getValorisationByPropertyKey(individu?.valorisations, 'indNomUsage');
        const indNomNaissance = getValorisationByPropertyKey(individu?.valorisations, 'indNomNaissance');
        return `${indPrenom} ${indNomUsage !== 'Pas de valeur' ? indNomUsage : indNomNaissance }`;
    };

    const getIconTypeBulletin = (bulletin: BulletinChronologiqueModel): JSX.Element => {
        switch(BulletinTypeEnum.code(bulletin.type)) {
        case 'Normal':
            if(BulletinStatutEnum.code(bulletin.statut) === 'Annule')
            {
                return <YpElement className='flex items-center'>
                    <BulletinAnnuleIcon width={ 12 } height={ 14 }/>
                </YpElement>;
            } else {
                return <YpTypography color='blue-500'>
                    <FontAwesomeIcon icon={ ['far', 'file-lines'] } />
                </YpTypography>;
            }
        case 'Annulation':
            return <YpElement>
                <BulletinAnnulationIcon width={ 12 } height={ 14 }/>
            </YpElement>;
        case 'Remplacement':
            return <YpElement>
                <BulletinRemplacementIcon width={ 12 } height={ 14 }/>
            </YpElement>;
        case 'Complementaire':
            return <YpElement>
                <BulletinComplementaireIcon width={ 12 } height={ 14 }/>
            </YpElement>;
        default:
            return <YpTypography color='blue-500'>
                <FontAwesomeIcon icon={ ['far', 'file-lines'] } />
            </YpTypography>;
        }
    };

    const getDateFormatBulletin = (bulletin: BulletinChronologiqueModel): string =>
        `Du ${format((parseISO(bulletin.periode_paie.from ?? '')), 'dd/MM')} au ${format((parseISO(bulletin.periode_paie.to ?? '')), 'dd/MM')}`;

    const getLibelleBulletin = (bulletin: BulletinChronologiqueModel): string =>
        `Bulletin N° ${formatLeadingZeros(bulletin.numero, 3) } - ${getDateFormatBulletin(bulletin)}`;

    // Handlers
    const handleValidation = async (): Promise<WsDataModel | undefined> => {
        const payload = {
            annulations: [
                {
                    bulletins_ids: bulletinsIds,
                    contrat_id: contrat?.fiche_id,
                    avec_remplacement: form.getValues('annulations[0].avec_remplacement')
                }
            ]
        };

        const response = await form.actions?.annulation?.execute({
            data: payload
        }, true);

        const generationId = `${response?.data}`;

        if (response?.isSuccess) {
            notification.generation_progression.setCurrent({
                periode,
                generationId,
                dossier: dossierContext?.dossierDetail?.data ?? null,
                channel: `dossiers/${dossierContext?.dossierDetail?.data?.id}/generations/${generationId}`
            });

            handleClose();

            const bulletinsResponse = await bulletinsChronoList?.fetch({});
            if (bulletinsResponse?.isSuccess) {

                toastContext?.add({
                    title: 'Bulletins',
                    description: `${conjugate('bulletin d\'annulation', bulletinsIds.length, true, {
                        string: 'bulletin', replaceValue: 'bulletins'
                    })} en cours de génération`,
                    duration: Infinity,
                    icon: ['fad', 'spinner-third'],
                    status: 'info'
                });
            }
        }

        return response;
    };

    const handleClose = (): void => {
        form?.reset?.();
        form?.clearErrors();
        toggleModal();
    };

    return (
        <YpFormModal
            branding={ {
                subtitle: dossierContext?.dossierDetail?.data?.code ?? '',
                title: dossierContext?.dossierDetail?.data?.raison_sociale ?? '',
                thumbnail: dossierContext?.dossierDetail?.data?.logo_url_ressource ?? getTextPreview(dossierContext?.dossierDetail?.data?.code)
            } }
            modalContext={ {
                subtitle: getValorisationByPropertyKey(contrat?.valorisations, 'cntLibelleEmploi'),
                title: getIndividuLibelle() ?? '',
                thumbnail: getTextPreview(getIndividuLibelle())
            } }
            title=''
            size='medium'
            isOpen={ isOpen }
            isDirty={ true }
            isLoading={ form.actions?.annulation?.isLoading }
            confirmLabel='Générer'
            onClose={ handleClose }
            onValidation={ handleValidation }
        >
            <FormContextProvider { ...form }>
                <FormComponent
                    className={ 'flex' }
                    errors={ form.actions?.annulation?.errors }
                >
                    <YpElement className='border-t border-neutral-200 flex flex-col gap-2 h-full items-center pt-4 w-full'>
                        <YpElement className='px-8 pb-6'>
                            <YpTypography
                                size={ 18 }
                                weight='medium'
                            >
                                { `Générer ${conjugate('bulletin', filteredBulletinsToAnnule.length)} d’annulation` }
                            </YpTypography>
                            <YpTypography size={ 12 } color='neutral-500'>
                                { `Êtes-vous sûr de vouloir annuler
                                    ${conjugate('ce', filteredBulletinsToAnnule.length, false)}
                                    ${conjugate('bulletin', filteredBulletinsToAnnule.length, false)} ?`
                                }
                            </YpTypography>
                        </YpElement>
                        <YpElement className='max-h-80 overflow-y-auto w-60'>
                            <YpTypography
                                className='pb-2'
                                size={ 12 }
                                color={ 'neutral-500' }
                            >
                                { format(parseISO(wrapperContext?.dateValue.from), 'yyyy') }
                            </YpTypography>
                            {
                                bulletinsListToAnnule?.isLoading && !bulletinsListToAnnule?.isSuccess
                                    ? <YpSkeletonList
                                        count={ 3 }
                                        spacing={ 2 }
                                        size='small'
                                    />
                                    : map(orderBy(filteredBulletinsToAnnule, ['periode_rattachement.from'], ['asc']), (bulletin) => (
                                        <YpElement className={ cn('flex h-9 items-center mb-1 overflow-hidden p-2 rounded-md',
                                            'ring-1 ring-brand-500 ring-opacity-70 ring-inset transition-all w-full') }
                                        >
                                            <YpElement className={ 'border-neutral-100 flex items-center gap-2' }>
                                                <YpElement className='flex gap-1 items-center min-w-40 max-w-48'>
                                                    {
                                                        getIconTypeBulletin(bulletin)
                                                    }
                                                    <YpElement
                                                        className={ 'flex justify-start items-center' }
                                                    >
                                                        <YpTypography
                                                            className='overflow-hidden whitespace-nowrap'
                                                            size={ 10 }
                                                        >
                                                            { getLibelleBulletin(bulletin) }
                                                        </YpTypography>
                                                    </YpElement>
                                                </YpElement>
                                            </YpElement>
                                        </YpElement>
                                    ))
                            }
                        </YpElement>
                        <FormFieldComponent
                            className='border-b border-neutral-200 flex items-center'
                            { ...definition?.find((p: FormFieldModel)=> p.name === 'annulations[0].avec_remplacement') }
                            label={
                                filteredBulletinsToAnnule?.length > 1
                                    ? 'Générer des bulletins de remplacement'
                                    : 'Générer un bulletin de remplacement'
                            }
                        />
                    </YpElement>
                </FormComponent>
            </FormContextProvider>
        </YpFormModal>
    );
};

export default BulletinAnnulationFormComponent;
