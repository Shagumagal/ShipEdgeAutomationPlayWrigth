import {
    generateUSRecipient,
    generateUSRecipientForState,
    KnownRecipients,
    type RecipientData,
} from '../../lib/test-data';

type KnownRecipientName = keyof typeof KnownRecipients;

/** Builds recipient data without exposing Faker or shared mutable objects to specs. */
export class RecipientBuilder {
    private constructor(private readonly value: RecipientData) {}

    static randomUS(): RecipientBuilder {
        return new RecipientBuilder(generateUSRecipient());
    }

    static forUSState(state: string): RecipientBuilder {
        return new RecipientBuilder(generateUSRecipientForState(state));
    }

    static known(name: KnownRecipientName): RecipientBuilder {
        return new RecipientBuilder({ ...KnownRecipients[name] });
    }

    with(overrides: Partial<RecipientData>): RecipientBuilder {
        return new RecipientBuilder({ ...this.value, ...overrides });
    }

    build(): RecipientData {
        return { ...this.value };
    }
}
